# Redis 分布式锁与文档审核生命周期架构设计与实践

## 1. 业务背景与并发痛点

在企业知识库与智能体系统（Agent WLL）中，文档的**提审（Submit）**、**审批通过（Approve）**与**驳回（Reject）**是核心的状态流转操作。
![image](https://api.cheatppf.xyz/i/2go5gzhp4q4-zyihxo.png)
### 1.1 核心并发风险
1. **用户狂点与重试竞态**：作者在网络稍慢时连续快速点击“提交审核”，可能生成重复的待审任务流水。
2. **多审核员并发冲突**：多位审核员同时打开同一份文档，一人点击“通过”，另一人几乎在同一毫秒点击“驳回”。
3. **外部副作用放大**：审核通过不仅修改数据库，还会**向消息队列（RabbitMQ）投递事件**，触发下游大模型切分（Chunking）、向量化（Embedding）与全文索引构建。如果并发穿透导致重复审批，将产生不可逆的重复算力消耗和索引脏数据。

---

## 2. 纵深防御架构（Defense-in-Depth）

为了兼顾**高并发吞吐**与**数据强一致性**，系统采用了 **“外层 Redis 分布式锁快速拦截 + 底层 PostgreSQL 悲观行锁兜底”** 的双重防御体系：

```
                    [ 客户端请求 / 并发点击 / 多个审核员 ]
                                     │
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │  【外层门禁】Redis 异步分布式锁 (SETNX + Lua 原子释放)   │
        └────────────────────────────┬────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     │ 抢锁失败                      │ 抢锁成功 (耗时 ~2ms)
                     ▼                               ▼
        ┌─────────────────────────┐     ┌─────────────────────────┐
        │  HTTP 409 Conflict 拦截 │     │  进入 FastAPI Service   │
        │  "当前任务正在处理中"    │     └───────────┬─────────────┘
        └─────────────────────────┘                 │
                                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │  【底层兜底】PostgreSQL 事务与悲观行锁 (FOR UPDATE)     │
        │  • 锁定 kh_document_review 与 kh_document 数据行        │
        │  • 杜绝极端超时或降级场景下的数据脏写                   │
        └────────────────────────────┬────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
        ┌─────────────────────────┐     ┌─────────────────────────┐
        │ 1. 更新 PG 元数据/状态   │     │ 3. 投递 RabbitMQ 消息   │
        │ 2. 更新 Mongo 正文预览  │     │ 4. 释放 Redis 分布式锁   │
        └─────────────────────────┘     └─────────────────────────┘
```

---

## 3. Redis 分布式锁核心技术实现

代码落位于 [`app/core/redis.py`](file:///d:/self/agent-wll/app/core/redis.py)。

### 3.1 三大核心技术规范

#### ① 原子加锁与防死锁 (`SET key token NX EX seconds`)
- 采用 Redis 原生单指令原子加锁：`NX`（仅在 Key 不存在时设置）+ `EX`（设置秒级过期时间）。
- 即使服务在持锁期间意外宕机，超时后锁也会自动释放，彻底杜绝死锁。

#### ② 独占识别与防误删 (`UUID Token`)
- 每个请求生成全局唯一的 `token = str(uuid.uuid4())` 作为 Value 存入 Redis。
- 只有当前协程/线程持有的 Token 才能代表该锁的归属权。

#### ③ Lua 脚本原子释放 (Check-and-Delete)
- 如果采用先 `GET` 后 `DEL` 的两步操作，在网络卡顿或锁超时被他人获取后，可能产生误删他人锁的严重 Bug。
- 采用在 Redis 内部单线程执行的 Lua 脚本，原子完成比对与释放：
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
  ```

---

## 4. 核心代码设计与落地

### 4.1 通用上下文管理器 (`app/core/redis.py`)
```python
@asynccontextmanager
async def distributed_lock(
    lock_key: str,
    expire_seconds: int = 10,
    error_message: str = "当前任务正在处理中，请勿重复操作",
) -> AsyncGenerator[bool, None]:
    client = redis_manager.client
    if client is None:
        # 未配置或异常时优雅降级，直接放行 (依赖底层 DB 锁兜底)
        yield True
        return

    token = str(uuid.uuid4())
    # 1. 尝试原子抢占
    acquired = await client.set(lock_key, token, nx=True, ex=expire_seconds)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_message,
        )

    try:
        yield True
    finally:
        # 2. Lua 脚本原子释放
        try:
            await client.eval(LUA_RELEASE_LOCK, 1, lock_key, token)
        except Exception as e:
            logger.error(f"释放分布式锁异常: key={lock_key}, error={e}")
```

### 4.2 业务层接入示例 (`app/modules/audit/service.py`)

#### 提审防重（Submit）
```python
async def submit_for_review(self, document_id: str) -> DocumentResponseDto:
    doc_id_int = int(document_id)
    # 以文档 ID 作为锁粒度
    async with distributed_lock(
        f"lock:doc:submit:{doc_id_int}",
        expire_seconds=8,
        error_message="该文档正在提交审核中，请勿重复操作",
    ):
        # 业务校验与状态流转
        ...
```

#### 审批/驳回防并发决策（Approve / Reject）
```python
async def approve_review(self, review_id: str, ...) -> DocumentResponseDto:
    review_id_int = int(review_id)
    # 以审核记录 ID 作为锁粒度
    async with distributed_lock(
        f"lock:doc:review:{review_id_int}",
        expire_seconds=10,
        error_message="该审核任务正在处理中，请勿重复操作",
    ):
        # 1. 审批状态落库
        # 2. 触发异步流水线构建 RAG 向量 + 全文索引
        await self._safe_publish(doc.id)
        ...
```

---

## 5. 连接池管理与高可用机制

1. **生命周期绑定 (`main.py`)**：
   - 启动阶段：建立云端 Upstash Redis 异步长连接池，`PING` 探活并预热；
   - 退出阶段：优雅关闭连接池，释放底层 TCP 套接字。
2. **连接超时与重试保护**：
   - 配置 `socket_timeout=5.0` 与 `socket_connect_timeout=5.0`，避免网络波动阻塞事件循环。
3. **弹性熔断与优雅降级**：
   - 若云端 Redis 连接不可用，不阻断主服务启动，系统自动平滑降级，仅记录 Warning 日志并由底层的 PostgreSQL 行锁承担并发一致性保证。

---

## 6. 验证结果与指标

执行自动化测试脚本 `test-file/test_redis_lock.py`：
- **连接耗时**：Upstash Cloud TLS 长连接池复用，单次锁抢占与释放耗时 **< 5ms**；
- **并发互斥验证**：同一 Key 并发抢占立即触发 **HTTP 409 Conflict** 拦截；
- **释放验证**：业务完成后锁立即释放，下一轮操作可瞬间无缝获取。
