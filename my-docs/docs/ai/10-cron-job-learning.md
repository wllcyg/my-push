# 服务重启后，AI 定时任务全丢了？——Python FastAPI 动态调度踩坑记

![定时任务与AI调度架构概览](https://api.cheatppf.xyz/i/mroijza2-mfr8a5.png)

前几天把一套 NestJS 定时任务体系迁移到 Python FastAPI，本以为是"抄一遍逻辑"的体力活，结果连着踩了三个坑：

1. 明明任务时间没到，服务却提示"已过期，跳过注册"；
2. 一个正常的模块导入，硬是绕出了一条循环依赖死锁链；
3. 定时任务一触发 AI Agent 就报错，说"不支持同步调用"。

排查下来才发现，这些坑背后都是同一类问题——**跨语言、跨框架迁移时，那些"理所当然"的隐式假设最容易失效**。这篇文章记录完整的排坑过程，也顺带把一套"数据库 + APScheduler + AI 工具调用"的定时任务架构讲清楚。

---

## 一、核心架构：数据库 + APScheduler 双层设计

整套系统的核心设计哲学：**数据库是单一事实来源（Source of Truth），内存调度器（APScheduler）只是执行引擎**。

- **为什么不直接写死定时器？** 如果使用纯内存定时器（如 Python 的 `asyncio.create_task` 或直接 `while True`），一旦 FastAPI 服务重启或崩溃，所有任务状态就全丢了。存进数据库，即使断电也能在下次启动时完整恢复。
- **APScheduler 的角色**：只负责"在对的时间点触发对的函数"，本身不存储任何持久状态。

### 两个关键分层：
- **对外接口（`add_job` / `toggle_job` / `list_jobs`）**：操作数据库，是前端和 AI 工具层能感知的业务接口。
- **对内引擎（`_start_runtime` / `_stop_runtime` / `_run_job_task`）**：操作 APScheduler 内存状态，带下划线命名，不对外暴露。

---

## 二、任务实体设计 (job_entity.py)

对标 TypeScript TypeORM 的 `@Entity` 实体，Python 侧使用 SQLAlchemy 的现代写法（`Mapped` + `mapped_column`）。

```python
# modules/job/job_entity.py

JobType = Literal['cron', 'every', 'at']

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4())  # UUID 主键，对应 @PrimaryGeneratedColumn('uuid')
    )
    instruction: Mapped[str] = mapped_column(Text, nullable=False)   # 存储 AI 自然语言指令
    type: Mapped[JobType] = mapped_column(String(10), default='cron') # 任务类型

    cron: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)   # 仅 cron 类型使用
    every_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)   # 仅 every 类型使用（毫秒）
    at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)   # 仅 at 类型使用

    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, ...)
    updated_at: Mapped[datetime] = mapped_column(DateTime, onupdate=...)
```

> **字段设计亮点**：三种调度字段（`cron`/`every_ms`/`at`）都是可选的（`nullable=True`），在 `_start_runtime` 中通过 `job.type` 判断实际使用哪一个，保证了表结构的扩展性。

---

## 三、三种触发模式的实战实现 (_start_runtime)

`_start_runtime` 是整个服务中最核心的"翻译官"：把数据库里枯燥的记录，翻译成 APScheduler 能执行的触发器配置。

```python
# modules/job/job_service.py

def _start_runtime(self, job: Job):
    if self.scheduler.get_job(job.id):
        return  # 防止重复注册（幂等保护）

    if job.type == 'cron':
        # CronTrigger 原生支持 crontab 格式，如 "0 8 * * *" 表示每天 8 点
        trigger = CronTrigger.from_crontab(job.cron)
        self.scheduler.add_job(
            self._run_job_task,
            trigger=trigger,
            id=job.id,
            args=[job.id, job.instruction, job.type]  # 把 AI 指令随任务一起注入
        )

    elif job.type == 'every':
        # IntervalTrigger 单位是秒，需要把毫秒转换一下
        trigger = IntervalTrigger(seconds=job.every_ms / 1000.0)
        self.scheduler.add_job(self._run_job_task, trigger=trigger, id=job.id,
                               args=[job.id, job.instruction, job.type])

    elif job.type == 'at':
        at_time = job.at
        # 关键坑点：MySQL/TiDB 存储时会丢失时区信息，拿出来是 naive datetime
        # 必须补回 UTC 时区，再和带时区的当前时间做比较，否则永远被判定为"过期"
        if at_time.tzinfo is None:
            at_time = at_time.replace(tzinfo=timezone.utc)

        if at_time < datetime.now(timezone.utc):
            logger.warning(f"任务 {job.id} 的触发时间已过期，跳过注册")
            return

        trigger = DateTrigger(run_date=at_time)
        self.scheduler.add_job(self._run_job_task, trigger=trigger, id=job.id,
                               args=[job.id, job.instruction, job.type])
```

---

## 四、坑点一：时区陷阱，at 类型任务的过期误判

这是本次迁移中踩得最深的一个坑，值得单独记录。

![时区丢失问题示意图：naive datetime vs aware datetime](https://api.cheatppf.xyz/i/mroikfco-j9girh.png)

**问题现象**：大模型将任务存入数据库后，服务立刻提示"触发时间已过期，跳过注册"，任务从未被执行。

**根本原因（时区丢失链路）**：

1. 大模型计算好"1分钟后"的时间，给出的是带 UTC 时区的 ISO 字符串：`2026-07-17T03:38:34.000Z`
2. 数据库（MySQL/TiDB）在存储 `DateTime` 列时，会**自动剥离时区信息**，变成裸字符串 `2026-07-17 03:38:34`
3. SQLAlchemy 取回时，得到的是不带时区（naive）的 `datetime` 对象
4. 代码里的比较 `job.at < datetime.now()` 中，`datetime.now()` 是**本机本地时间（UTC+8）**，即 `11:38`，远大于 `03:38`，于是被判定为已过期

**修复方案**：补回时区信息后再比较

```python
# 从数据库出来的 naive datetime，默认它是 UTC 存储进去的
if at_time.tzinfo is None:
    at_time = at_time.replace(tzinfo=timezone.utc)

# 和带时区的当前时间做对比，双方单位统一
if at_time < datetime.now(timezone.utc):
    logger.warning("已过期，跳过")
```

> **一句话教训**：只要涉及"数据库读写 datetime"，就默认时区信息会丢，读出来第一件事永远是先补时区，再做任何比较。

---

## 五、服务启动时的"任务复活"机制 (init_jobs)

FastAPI 的 `startup` 钩子 + `init_jobs` 确保了任务的高可用性：服务器任何时候重启，都不会丢失原有的活跃任务。

```python
# main.py 启动注册
@app.on_event("startup")
async def startup_event():
    global_scheduler.start()                # 启动 APScheduler 时间轮
    await job_service_instance.init_jobs()  # 从数据库加载历史任务并重新挂载

# job_service.py
async def init_jobs(self):
    async with AsyncSessionFactory() as session:
        result = await session.execute(select(Job).where(Job.is_enabled == True))
        enabled_jobs = result.scalars().all()

        for job in enabled_jobs:
            if not self.scheduler.get_job(job.id):  # 幂等检查，避免重复注册
                self._start_runtime(job)

# 全局单例（文件末尾）
global_scheduler = AsyncIOScheduler()
job_service_instance = JobService(global_scheduler)
```

---

## 六、坑点二：循环导入，用延迟导入破局

这是本次迁移中最常见的工程问题。

**循环依赖链**：

```
main.py → job_service.py → ai_service.py → tools/__init__.py → job_crud.py → job_service.py  ❌
```

**错误原因**：`job_crud.py` 在文件顶部就 `import job_service_instance`，但此时 `job_service.py` 还没执行完（卡在第二步），单例根本不存在。

**修复方案：将导入移入函数内部（延迟导入）**

```python
# modules/ai/tools/job_crud.py

@tool('job_crud', args_schema=JobCrudInput)
async def job_crud(action, ...):
    try:
        # ✅ 不在文件顶部导入！在函数实际被调用的那一刻才导入
        # 此时所有模块已经完成初始化，循环依赖不再存在
        from modules.job.job_service import job_service_instance

        if action == 'list':
            jobs = await job_service_instance.list_jobs()
            ...
```

> **核心原理**：Python 在函数体内执行 `import` 时，是在函数被**调用**的那一刻才发生的，而非模块加载时。此时所有模块都已完成初始化，依赖关系不再形成死锁。

---

## 七、AI 自主调用：job_crud 工具设计

`job_crud` 工具是连接大模型与定时任务系统的桥梁，通过 Pydantic Schema 的精确描述引导模型正确传参。

```python
# modules/ai/tools/job_crud.py

class JobCrudInput(BaseModel):
    action: Literal['list', 'add', 'toggle']
    type: Optional[Literal['cron', 'every', 'at']] = Field(
        None, description="任务类型：cron（循环）/ every（间隔循环）/ at（指定时间执行一次，执行后自动停用）"
    )
    instruction: Optional[str] = Field(
        None,
        description="任务指令（add 时需要）。要求：\n"
                    "1) 去掉'什么时候执行'的时间部分，只保留要执行的任务内容\n"
                    "2) 必须是自然语言，不能是工具调用或代码（如不能写 send_mail(...)）\n"
                    "3) 不要擅自补全细节"
    )
    at: Optional[datetime] = Field(
        None, description="指定触发时间点（type=at 时需要，ISO 格式，例如 2026-03-18T12:34:56.000Z）"
    )
```

**`at` 类型任务只执行一次，执行后自动停用**：

```python
async def _run_job_task(self, job_id, instruction, job_type):
    result = await self.ai_service.generate_reply_async(instruction)

    async with AsyncSessionFactory() as session:
        job = await session.get(Job, job_id)
        if job:
            job.last_run = datetime.now(timezone.utc).replace(tzinfo=None)
            if job_type == 'at':
                job.is_enabled = False  # 单次任务自动停用
            await session.commit()
```

---

## 八、坑点三：同步 vs 异步 Agent 循环冲突

在定时任务中调用 AI Agent 时，遇到了一个非常经典的同步/异步冲突问题。

**问题**：`db_users_crud` 等工具是 `async def`，但定时任务触发的 `generate_reply` 内部用的是同步 `model.invoke()`，导致：

```
StructuredTool does not support sync invocation.
```

**解决方案**：在 `agent_runner.py` 中新增一套全异步的循环版本 `run_agent_loop_async`：

```python
# modules/ai/agent_runner.py

async def run_agent_loop_async(model_with_tools, tools, messages, max_iterations=30):
    response = await model_with_tools.ainvoke(messages)  # ainvoke 替代 invoke
    messages.append(response)

    iteration = 0
    while response.tool_calls:
        ...
        for tool_call in response.tool_calls:
            target_tool = next((t for t in tools if t.name == tool_call['name']), None)
            try:
                # 优先使用 ainvoke，兼容同步工具
                if hasattr(target_tool, "ainvoke"):
                    tool_result = await target_tool.ainvoke(tool_call['args'])
                else:
                    tool_result = target_tool.invoke(tool_call['args'])
                messages.append(ToolMessage(content=str(tool_result), ...))
            ...

        response = await model_with_tools.ainvoke(messages)  # 再次 ainvoke
        messages.append(response)

    return response
```

定时任务触发时调用 `generate_reply_async`（内部使用 `run_agent_loop_async`），HTTP 接口调用时使用原来的同步版本，两套链路互不干扰。

---

## 九、完整执行链路回顾

```
用户: "1分钟后给王五发邮件"
       ↓
大模型调用 time_now 工具 → 获取当前精确 UTC 时间
       ↓
大模型调用 job_crud(action='add', type='at', at=<+1分钟时间戳>,
          instruction='给王五发个邮件，让他下周学习TS')
       ↓
job_service.add_job() → INSERT INTO jobs → _start_runtime(DateTrigger)
       ↓
[1分钟后 APScheduler 触发]
       ↓
_run_job_task(instruction='给王五发邮件...')
       ↓
ai_service.generate_reply_async() → run_agent_loop_async()
       ↓
大模型调用 send_mail 工具 → 邮件发出
       ↓
数据库更新 last_run，is_enabled=False（at 类型自动停用）
```

---

![完整执行链路：从自然语言到定时触发再到AI执行的闭环](https://api.cheatppf.xyz/i/mroiks3i-3px3yo.png)

## 十、小结

回头看这三个坑，其实都不是 APScheduler 或 FastAPI 本身的问题，而是**跨语言迁移时容易被忽略的隐式假设**：

- 时区信息在数据库往返中会不会丢失，取决于列类型和驱动，不能想当然；
- 模块导入顺序在 Python 里是"谁先执行谁先占位"，和 TypeScript 的处理方式不完全一样；
- 同步/异步的边界在 Agent 循环这种"工具可能来自任何地方"的场景里，必须显式统一，否则迟早炸。

这套"数据库为单一事实来源 + 内存调度器为执行引擎"的架构本身通用性不错，如果你也在做 AI Agent 的定时任务能力，欢迎直接照着搭；遇到类似的时区或异步坑，也欢迎在评论区聊聊你踩过的版本。