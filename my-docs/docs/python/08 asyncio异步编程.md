# Python asyncio 异步编程 - 深度教程

> 做 AI 应用和后端接口，90% 的时间都在**等**：等数据库、等第三方 API、等大模型返回。
> 异步让一个进程在等待时去处理别的请求。你熟悉 JS 的 `async/await`，Python 的语法几乎一样，
> 但**运行机制有几处关键差异**，不搞清楚就会踩坑。

## 目录

1. 为什么需要异步
2. 基础：async def、await、asyncio.run
3. 并发：create_task 与 gather
4. 超时、取消与异常
5. 限流：Semaphore
6. 阻塞代码的处理：to_thread
7. async for、async with 与异步生成器
8. 实战：httpx 异步请求
9. 实战：FastAPI 流式输出（大模型打字机效果）
10. 和 JavaScript Promise 的关键差异
11. 常见错误清单
12. 练习题
13. 学习检查清单

---

## 为什么需要异步

假设一个接口要依次做 3 件事，每件事都要等网络 1 秒：

- **同步**：1 + 1 + 1 = 3 秒，等待期间线程什么也干不了。
- **异步并发**：三件事同时发出，总共约 1 秒。
- **异步服务器**：某个请求在等待时，事件循环去处理别的请求，同一个进程可以同时服务成千上万个连接。

异步适合 **I/O 密集型**（网络、数据库、文件）。**CPU 密集型**（大量计算、图像处理）异步帮不上忙，
要用多进程（`multiprocessing` / `ProcessPoolExecutor`）。

---

## 基础：async def、await、asyncio.run

```python
import asyncio

async def fetch(name: str, delay: float) -> str:
    print(f"{name} 开始")
    await asyncio.sleep(delay)           # 模拟网络等待，注意是 asyncio.sleep，不是 time.sleep
    print(f"{name} 结束")
    return f"{name} 的结果"

async def main():
    result = await fetch("A", 1)
    print(result)

asyncio.run(main())                      # 程序入口：创建事件循环并运行 main
```

要点：

- `async def` 定义**协程函数**。调用它**不会执行函数体**，只会返回一个协程对象。
- `await` 只能在 `async def` 内部使用，作用是"等这个协程跑完，期间把控制权交还事件循环"。
- `asyncio.run()` 是整个异步程序的入口，一个程序里通常只调用一次。
- 在 Jupyter 里已经有运行中的事件循环，直接写 `await main()` 即可。

```python
coro = fetch("A", 1)
print(coro)          # <coroutine object fetch at 0x...>，函数体根本没执行
# 如果之后既不 await 也不调度，Python 会警告：coroutine was never awaited
```

### 顺序 await 并没有并发

```python
async def main():
    a = await fetch("A", 1)
    b = await fetch("B", 1)
    # 总耗时 2 秒：await 会等前一个彻底结束才继续
```

想要并发，必须让多个协程**同时被调度**，见下一节。

---

## 并发：create_task 与 gather

### asyncio.gather：并发运行多个协程，等全部完成

```python
import asyncio, time

async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        fetch("A", 1),
        fetch("B", 1),
        fetch("C", 1),
    )
    print(results)                                   # 按传入顺序返回结果列表
    print(f"耗时 {time.perf_counter() - start:.1f}s")   # ≈ 1.0s，而不是 3s

asyncio.run(main())
```

动态数量的任务：

```python
async def main():
    urls = [f"id-{i}" for i in range(10)]
    results = await asyncio.gather(*(fetch(u, 0.5) for u in urls))
```

### asyncio.create_task：立即调度，稍后再等结果

```python
async def main():
    t1 = asyncio.create_task(fetch("A", 1))     # 马上开始在后台运行
    t2 = asyncio.create_task(fetch("B", 1))

    print("两个任务已经在跑了，这里可以做别的事")
    r1 = await t1
    r2 = await t2
```

**`create_task` 之后必须保存好返回的 task 引用**。如果只写 `asyncio.create_task(foo())` 不保存，
任务可能被垃圾回收而中途消失。

### TaskGroup（3.11+，推荐）

```python
async def main():
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch("A", 1))
        t2 = tg.create_task(fetch("B", 2))
    # 退出 async with 时，所有任务都已完成；任何一个任务失败，其余会被自动取消
    print(t1.result(), t2.result())
```

与 `gather` 相比，TaskGroup 的异常处理更安全，不会留下"孤儿任务"。

### as_completed：谁先完成先处理谁

```python
async def main():
    tasks = [fetch("A", 3), fetch("B", 1), fetch("C", 2)]
    for fut in asyncio.as_completed(tasks):
        print(await fut)                  # 依次输出 B、C、A 的结果
```

---

## 超时、取消与异常

### 超时

```python
async def main():
    try:
        async with asyncio.timeout(2):                 # 3.11+
            await fetch("slow", 10)
    except TimeoutError:
        print("超时了")

    # 老写法（所有 3.7+ 版本）
    try:
        await asyncio.wait_for(fetch("slow", 10), timeout=2)
    except asyncio.TimeoutError:
        print("超时了")
```

调用外部服务（尤其是大模型 API）**一定要设超时**，否则一个卡住的请求会一直占着资源。

### 取消

```python
async def main():
    task = asyncio.create_task(fetch("A", 10))
    await asyncio.sleep(1)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("任务已取消")
```

协程里捕获异常时，**不要吞掉 `CancelledError`**（它在 3.8+ 继承自 `BaseException`，
`except Exception` 不会误捕获，但写 `except BaseException` 或裸 `except:` 会）。
需要清理资源就用 `try/finally`。

### gather 中的异常

```python
async def boom():
    raise ValueError("出错了")

async def main():
    # 默认：第一个异常会立刻抛出，其他任务继续在后台跑
    # return_exceptions=True：异常作为结果返回，不会中断其他任务
    results = await asyncio.gather(fetch("A", 1), boom(), return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            print("失败:", r)
        else:
            print("成功:", r)
```

---

## 限流：Semaphore

并发不是越多越好。对第三方接口一口气发 1000 个请求，会被限流甚至封禁。

```python
async def fetch_limited(sem: asyncio.Semaphore, i: int):
    async with sem:                       # 同一时刻最多放 N 个协程进来
        return await fetch(f"task-{i}", 0.5)

async def main():
    sem = asyncio.Semaphore(5)            # 最多 5 个并发
    results = await asyncio.gather(*(fetch_limited(sem, i) for i in range(20)))
```

数据库连接池、AI 接口调用，都应该用类似的方式控制并发数。

---

## 阻塞代码的处理：to_thread

事件循环是**单线程**的。如果在协程里调用了阻塞函数，**整个事件循环都会卡住**，
所有其他请求一起等。

```python
import time

async def bad():
    time.sleep(3)              # ❌ 阻塞整个事件循环 3 秒，其他请求全部卡死

async def good():
    await asyncio.sleep(3)     # ✅ 让出控制权
```

必须调用同步阻塞库（如旧的数据库驱动、`requests`、读大文件、PDF 解析）时，丢到线程里：

```python
import asyncio
import requests

def blocking_call(url: str) -> int:
    return requests.get(url, timeout=10).status_code      # 同步库

async def main():
    code = await asyncio.to_thread(blocking_call, "https://example.com")   # 3.9+
    print(code)
```

CPU 密集的任务用进程池：

```python
from concurrent.futures import ProcessPoolExecutor

async def main():
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, heavy_compute, 10_000_000)
```

---

## async for、async with 与异步生成器

### async with：异步上下文管理器

```python
import httpx

async def main():
    async with httpx.AsyncClient(timeout=10) as client:     # 离开时自动关闭连接
        resp = await client.get("https://example.com")
```

对应同步的 `with`，用来管理需要 `await` 才能打开或关闭的资源（HTTP 客户端、数据库会话）。
`two/project` 里的 `async with AsyncSessionFactory() as session:` 就是这种用法。

### 异步生成器：async def + yield

```python
async def countdown(n: int):
    while n > 0:
        await asyncio.sleep(0.5)
        yield n                    # 在 async def 里写 yield，就是异步生成器
        n -= 1

async def main():
    async for i in countdown(3):   # 用 async for 遍历
        print(i)
```

### 异步推导式

```python
async def main():
    values = [i async for i in countdown(3)]
    results = [await fetch(f"t{i}", 0.1) for i in range(3)]   # 注意这是顺序执行，不是并发
```

---

## 实战：httpx 异步请求

`requests` 是同步库，在异步代码里请换成 `httpx`（API 基本一致，同时支持同步与异步）。

```python
import asyncio
import httpx

async def fetch_json(client: httpx.AsyncClient, url: str) -> dict:
    resp = await client.get(url)
    resp.raise_for_status()                 # 4xx/5xx 抛异常
    return resp.json()

async def main():
    urls = [f"https://httpbin.org/get?id={i}" for i in range(5)]
    sem = asyncio.Semaphore(3)

    async with httpx.AsyncClient(timeout=10) as client:
        async def one(url):
            async with sem:
                try:
                    return await fetch_json(client, url)
                except httpx.HTTPError as e:
                    return {"error": str(e), "url": url}

        results = await asyncio.gather(*(one(u) for u in urls))
    print(len(results))

asyncio.run(main())
```

这段代码包含了异步爬取 / 批量调用接口时的全部要点：**复用 client、限流、超时、单个失败不影响整体**。

---

## 实战：FastAPI 流式输出（大模型打字机效果）

大模型流式接口的原理：模型每生成一小段文字就吐出来，服务端用**异步生成器**接住，
再一块一块推给前端。

```python
# main.py
import asyncio
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def fake_llm(prompt: str):
    """模拟大模型：一个字一个字地吐"""
    answer = f"你问的是：{prompt}。这是一个模拟的流式回答。"
    for ch in answer:
        await asyncio.sleep(0.05)
        yield ch

async def sse_stream(prompt: str):
    """把模型输出包装成 SSE（Server-Sent Events）格式"""
    async for token in fake_llm(prompt):
        payload = json.dumps({"token": token}, ensure_ascii=False)
        yield f"data: {payload}\n\n"
    yield "data: [DONE]\n\n"

@app.get("/chat")
async def chat(q: str):
    return StreamingResponse(sse_stream(q), media_type="text/event-stream")
```

运行：

```bash
uv run uvicorn main:app --reload
curl -N "http://127.0.0.1:8000/chat?q=你好"     # -N 关闭缓冲，能看到逐字输出
```

前端用 `fetch` 读取 `response.body` 的流，或 `EventSource` 消费即可。
接入真实模型时，把 `fake_llm` 换成 SDK 的流式调用，外层结构不变。
LangChain / LangGraph 的 `astream()`、`astream_events()` 返回的也是异步生成器。

---

## 和 JavaScript Promise 的关键差异

| 点 | JavaScript | Python asyncio |
|---|---|---|
| 调用异步函数 | **立即开始执行**，返回 Promise | **不执行**，只返回协程对象，`await` 或调度后才跑 |
| 并发手段 | `Promise.all([...])` | `asyncio.gather(...)` / `TaskGroup` |
| 后台启动 | 直接调用就行 | 必须 `asyncio.create_task(...)` |
| 事件循环 | 运行时内置，自动运行 | 需要 `asyncio.run(main())` 显式启动 |
| 阻塞函数 | 同样会卡住 | 同样会卡住，用 `asyncio.to_thread` |
| 顶层 await | ESM 支持 | 普通脚本**不支持**，要包在 `async def main()` 里 |
| 出错 | `.catch` / `try-catch` | `try/except`，gather 可 `return_exceptions=True` |
| 竞速 | `Promise.race` | `asyncio.wait(..., return_when=FIRST_COMPLETED)` |
| 超时 | 手写 race | `asyncio.timeout()` / `wait_for` |

最容易混淆的一点：

```python
# JS：fetchA() 一调用就开始请求了
# const p = fetchA();

# Python：fetch_a() 只是创建了协程对象，什么都还没发生
coro = fetch_a()
# 必须 await coro 或 asyncio.create_task(coro) 才会真正执行
```

---

## 常见错误清单

1. **忘记 await**

   ```python
   async def main():
       fetch("A", 1)        # ❌ 只创建了协程，永远不会执行，并有 RuntimeWarning
       await fetch("A", 1)  # ✅
   ```

2. **在异步函数里用阻塞调用**：`time.sleep`、`requests.get`、同步数据库驱动、`open().read()` 读大文件。
   改用 `asyncio.sleep`、`httpx`、异步驱动，或 `asyncio.to_thread`。

3. **在已有事件循环中再调用 `asyncio.run`**：报 `asyncio.run() cannot be called from a running event loop`。
   FastAPI 的路由函数里直接 `await` 就行，不要再 `asyncio.run`。

4. **`await` 写在循环里导致串行**：想并发就收集成列表再 `gather`。

5. **共享可变状态**：协程在 `await` 处会切换，修改共享变量要小心；需要时用 `asyncio.Lock()`。

6. **`create_task` 不保存引用**，任务被回收。

7. **FastAPI 里 `def` 与 `async def` 的区别**：
   - `async def` 路由直接跑在事件循环上，里面必须全是非阻塞调用。
   - 普通 `def` 路由会被放到线程池里运行，里面写同步阻塞代码是安全的。
   - 在 `async def` 里调用阻塞函数是最典型的"接口突然变慢、并发上不去"的原因。

---

## 练习题

### 练习 1：并发 vs 顺序

写两个版本：顺序和并发地调用 5 次 `await asyncio.sleep(1)`，打印各自耗时，验证约 5 秒 vs 约 1 秒。

### 练习 2：限流批量请求

用 `httpx.AsyncClient` 请求 20 个 URL，用 `Semaphore(5)` 限制并发，单个失败要记录而不是让整体崩掉。

### 练习 3：带超时的重试

写 `async def call_with_retry(func, retries=3, timeout=2)`：每次调用都带超时，失败等待后重试，全部失败抛出最后一个异常。

### 练习 4：流式接口

在 FastAPI 里实现 `/count?n=5`，每秒推送一个数字（SSE 格式），最后推送 `[DONE]`。

<details>
<summary>参考答案（练习 1、3）</summary>

```python
import asyncio, time

async def task():
    await asyncio.sleep(1)

async def sequential():
    for _ in range(5):
        await task()

async def concurrent():
    await asyncio.gather(*(task() for _ in range(5)))

async def timed(coro_fn):
    s = time.perf_counter()
    await coro_fn()
    return time.perf_counter() - s

async def main():
    print("顺序", await timed(sequential))     # ≈ 5.0
    print("并发", await timed(concurrent))     # ≈ 1.0

asyncio.run(main())
```

```python
import asyncio

async def call_with_retry(func, retries=3, timeout=2, delay=0.5):
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return await asyncio.wait_for(func(), timeout=timeout)
        except Exception as e:             # 注意：不会吞掉 CancelledError
            last_exc = e
            print(f"第 {attempt} 次失败: {e!r}")
            if attempt < retries:
                await asyncio.sleep(delay * attempt)     # 递增等待
    raise last_exc
```

</details>

---

## 学习检查清单

- [ ] 能解释"协程函数调用后不会执行"
- [ ] 会用 `asyncio.run`、`gather`、`create_task`、`TaskGroup`
- [ ] 会给外部调用加 `timeout`，会用 `Semaphore` 限流
- [ ] 知道为什么不能在 `async def` 里用 `time.sleep` / `requests`
- [ ] 会用 `asyncio.to_thread` 包装阻塞代码
- [ ] 理解 `async with`、`async for`、异步生成器
- [ ] 能用 `StreamingResponse` 写出流式接口
- [ ] 能说出和 JS Promise 的主要差异
- [ ] 完成所有练习题

继续学习：**09_FastAPI与SQLAlchemy实战.md**