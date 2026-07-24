# RedisService 封装类开发使用文档

本模块封装了基于 **Upstash Redis (REST API)** 的统一缓存服务，支持 Python 对象的自动 JSON 序列化/反序列化、Key 命名空间隔离、全局异常兜底保护以及原生客户端的无缝调用。

---

## 目录
1. [快速开始](#1-快速开始)
2. [核心 API 手册](#2-核心-api-手册)
   - [JSON 对象操作 (推荐)](#json-对象操作-推荐)
   - [字符串操作](#字符串操作)
   - [辅助与键管理操作](#辅助与键管理操作)
   - [高级原生客户端句柄](#高级原生客户端句柄)
3. [典型业务场景最佳实践](#3-典型业务场景最佳实践)
   - [场景 A：接口/模型缓存 (FastAPI)](#场景-a接口模型缓存-fastapi)
   - [场景 B：Agent 对话上下文持久化](#场景-bagent-对话上下文持久化)
   - [场景 C：API 接口限流器](#场景-capi-接口限流器)
4. [注意事项](#4-注意事项)

---

## 1. 快速开始

在项目的任何业务模块中，直接导入预先配置好的 `redis_service` 单例即可使用：

```python
from redis.service import redis_service

# 写入缓存（字典自动序列化为 JSON，有效期 300 秒）
redis_service.set_json("user:10086", {"name": "Moliang", "role": "admin"}, ttl=300)

# 读取缓存（自动反序列化为 Python 字典）
user = redis_service.get_json("user:10086")
print(user["name"])  # 输出: Moliang
```

---

## 2. 核心 API 手册

### JSON 对象操作 (推荐)

针对字典、列表、数字、布尔值等复合 Python 对象，建议优先使用此组 API。

#### `set_json(key: str, value: Any, ttl: Optional[int] = None) -> bool`
将 Python 任意可 JSON 序列化的对象存入 Redis。
- **参数**：
  - `key` (*str*): 键名（内部会自动加上前缀 `my_app:key`）。
  - `value` (*Any*): 包含字典、列表、数字、字符串等可序列化对象。
  - `ttl` (*int, 可选*): 过期时间，单位为秒。
- **返回值**：*bool*，表示操作是否成功。

#### `get_json(key: str) -> Optional[Any]`
读取指定 Key 并自动反序列化为原始 Python 对象。
- **返回值**：解包后的 *dict / list / int* 等对象；若 Key 不存在或已过期则返回 `None`。

---

### 字符串操作

针对原始文本或字符串的读取。

#### `set_str(key: str, value: str, ttl: Optional[int] = None) -> bool`
设置字符串类型的值。

#### `get_str(key: str) -> Optional[str]`
获取字符串类型的值。

---

### 辅助与键管理操作

#### `incr(key: str, amount: int = 1) -> Optional[int]`
数值累加计数器。若 Key 不存在，自动初始化为 0 再自增。

#### `delete(key: str) -> bool`
删除指定的 Key。

#### `exists(key: str) -> bool`
检查指定的 Key 是否在 Redis 中存在。

#### `expire(key: str, ttl: int) -> bool`
给现有的 Key 重新/动态设置过期时间（秒）。

---

### 高级原生客户端句柄

#### `get_client() -> Optional[Redis]`
获取底层的 Upstash Redis 原生客户端。当需要使用 Redis 原生命令（如 ZSet 有序集合、Stream 消息流、Set 交并集）时使用。

**使用示例**：
```python
client = redis_service.get_client()
if client:
    # 使用原生 ZSet 排行榜命令
    client.zadd("my_app:rank", {"player1": 100, "player2": 250})
    top_players = client.zrevrange("my_app:rank", 0, 9, withscores=True)
```

---

## 3. 典型业务场景最佳实践

### 场景 A：接口/模型缓存 (FastAPI)

```python
from fastapi import APIRouter
from redis.service import redis_service

router = APIRouter()

@router.get("/user/{user_id}")
async def get_user_profile(user_id: str):
    cache_key = f"user_profile:{user_id}"
    
    # 1. 优先查缓存
    cached_data = redis_service.get_json(cache_key)
    if cached_data:
        return {"source": "cache", "data": cached_data}
    
    # 2. 缓存未命中，查数据库 (模拟)
    db_data = {"user_id": user_id, "name": "Moliang", "score": 98}
    
    # 3. 写回缓存，缓存 10 分钟
    redis_service.set_json(cache_key, db_data, ttl=600)
    
    return {"source": "db", "data": db_data}
```

---

### 场景 B：Agent 对话上下文持久化

```python
from redis.service import redis_service

def append_agent_message(session_id: str, role: str, content: str):
    history_key = f"agent_history:{session_id}"
    
    # 获取已有历史记录或初始化
    history = redis_service.get_json(history_key) or []
    history.append({"role": role, "content": content})
    
    # 更新存储，保存 3 天
    redis_service.set_json(history_key, history, ttl=3 * 86400)

def load_agent_history(session_id: str):
    return redis_service.get_json(f"agent_history:{session_id}") or []
```

---

### 场景 C：API 接口限流器

```python
from redis.service import redis_service
from fastapi import HTTPException

def check_rate_limit(ip_address: str, limit: int = 10, window: int = 60):
    rate_key = f"rate:{ip_address}"
    current_count = redis_service.incr(rate_key)
    
    if current_count == 1:
        redis_service.expire(rate_key, window)
        
    if current_count > limit:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
```

---

## 4. 注意事项

1. **环境变量**：服务启动前请确保根目录的 `.env` 文件包含有效的凭证：
   ```env
   UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="AXXX..."
   ```
2. **容错机制**：如果 Redis 凭证缺失或网路超时，`redis_service` 方法内部会捕获异常并返回 `None` / `False`，保证主业务不受阻塞崩塌。
3. **Key 命名规范**：`redis_service` 默认使用 `my_app` 前缀。手动调用原生 `get_client()` 时需要显式带上前缀。
