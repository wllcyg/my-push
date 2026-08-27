# Agent 中间件执行引擎 —— 教学讲解
![image](https://api.cheatppf.xyz/i/2go5idaks3i-s2o29o.png)
> 目标读者:有前端开发经验(Vue/TS)、Python 是初学的同学。

---

## 0. 先建立整体印象

这段代码要解决的问题是:**如何让大模型自动"调用工具 → 拿到结果 → 再想一想 → 继续调用或给出最终答案"这一整套循环,并且允许在循环的各个节点插入"中间件"做额外处理(日志、鉴权、改写请求、缓存等)。**

如果你用过 axios 拦截器、Koa/Express 中间件、Redux middleware,这套设计思路你会很熟悉——都是**洋葱模型(onion model)**:请求方向一层层往里传,响应方向再一层层往外传。

整体结构分 6 块:

| 模块 | 作用 |
|---|---|
| 消息类型 | 对话里流转的"包裹"(用户消息/AI消息/工具结果) |
| State | 整个运行过程的全局状态 |
| ModelRequest | 一次调用大模型所需的参数打包 |
| Middleware | 可插拔的钩子 + 洋葱包裹逻辑 |
| AgentExecutor | 真正跑主循环的引擎 |
| create_agent | 对外暴露的工厂函数 |

---

## 1. 消息类型

```python
class HumanMessage(BaseMessage):
    role = "human"

class AIMessage(BaseMessage):
    role = "ai"
    def __init__(self, content, tool_calls=None):
        super().__init__(content)
        self.tool_calls = tool_calls or []

class ToolMessage(BaseMessage):
    role = "tool"
    def __init__(self, content, tool_call_id):
        super().__init__(content)
        self.tool_call_id = tool_call_id
```

- `HumanMessage`:用户说的话。
- `AIMessage`:模型的回复,**多了一个 `tool_calls` 字段**——如果模型说"我需要调用工具 A、B",这个字段就会有内容,类似:
  ```python
  [{"id": "call_1", "name": "search", "args": {"query": "天气"}}]
  ```
- `ToolMessage`:工具执行完之后的结果,需要带上 `tool_call_id` 告诉模型"这是你刚才要的那次调用的结果"。

**类比**:如果你写过聊天界面,这三种消息就相当于渲染列表里的三种气泡类型,只是这里多了"工具调用"这一种角色。

---

## 2. State:全局状态

```python
class AgentState(dict):
    pass

def merge_state(state, update):
    for k, v in update.items():
        if k == "jump_to":
            continue
        if k == "messages":
            state["messages"] = state.get("messages", []) + v   # 追加
        else:
            state[k] = v   # 覆盖
```

`AgentState` 本质就是一个字典,专门存整个 agent 运行期间的所有数据(聊天记录、自定义字段都行)。

**关键规则**只有一条,但很重要:

- 字段名是 `"messages"` → **追加**(聊天记录只会变长,不会被覆盖掉)
- 其他任何字段 → **覆盖**(比如你自定义一个 `retry_count`,新值直接顶替旧值)
- `"jump_to"` 这个 key 会被跳过,不写进 state ——它是个"指令",不是"数据"(下面第 4 节会讲它的用途)。

**类比 Vue**:这跟 `Object.assign` 或者 Vue 的响应式对象合并很像,只是这里对 `messages` 字段特殊处理成"数组拼接"而不是"整体替换"。

---

## 3. ModelRequest:调用模型的参数封装

```python
class ModelRequest:
    def __init__(self, messages, system_prompt="", tools=None):
        self.messages = messages
        self.system_prompt = system_prompt
        self.tools = tools or []

    def override(self, **kwargs):
        new_req = ModelRequest(self.messages.copy(), self.system_prompt, self.tools.copy())
        new_req.__dict__.update(kwargs)
        return new_req
```

每次真正去调用大模型 API 之前,都要把"这次要发的消息、system prompt、可用工具"打包成一个 `ModelRequest` 对象。

`.override()` 的作用是:**复制一份,再改几个字段**,常用于中间件里"我想在原来的基础上改一下 system_prompt,但不想动其他内容"的场景。比如:

```python
new_request = request.override(system_prompt=request.system_prompt + "\n注意用中文回答")
```

---

## 4. Middleware —— 全文最核心的设计

### 4.1 基类长什么样

```python
class AgentMiddleware:
    def before_agent(self, state, runtime=None): return None
    def before_model(self, state, runtime=None): return None
    def after_model(self, state, runtime=None): return None
    def after_agent(self, state, runtime=None): return None

    def wrap_model_call(self, request, handler):
        return handler(request)

    def wrap_tool_call(self, tool_call, handler):
        return handler(tool_call)
```

写一个自己的中间件,只需要继承这个类,**按需重写其中几个方法**即可,不用全部实现。

### 4.2 前四个钩子(before/after)—— 好理解的部分

| 钩子 | 触发时机 |
|---|---|
| `before_agent` | 整个 agent 开始跑之前,**只跑一次** |
| `before_model` | 每一次准备调用模型之前 |
| `after_model` | 每一次模型返回之后 |
| `after_agent` | 整个 agent 结束之前,**只跑一次** |

这几个方法可以返回一个 `dict`(比如 `{"messages": [...]}`),引擎会自动 `merge_state` 合并进全局状态。

其中 `before_model` 和 `before_agent` 还支持一个特殊返回值:

```python
def before_model(self, state, runtime=None):
    if 触发了敏感词:
        return {"jump_to": "end"}   # 直接跳到结束,不再调用模型
```

这就是**短路机制**——类似 Express 中间件里 `return res.status(403).send()` 而不调用 `next()`,提前终止后续流程。

### 4.3 `wrap_model_call` / `wrap_tool_call` —— 洋葱模型

这两个方法不是"钩子",而是**包裹**。它们接收一个 `handler`(下一层要调用的函数),自己决定"调用前做什么、调用 handler、调用后做什么、要不要调用 handler"。

```python
class LoggingMiddleware(AgentMiddleware):
    def wrap_model_call(self, request, handler):
        print("→ 发送请求:", request.messages[-1])
        response = handler(request)          # 调用下一层
        print("← 收到响应:", response.content)
        return response
```

引擎是这样把多个中间件"叠"成一个调用链的:

```python
def _build_model_chain(self):
    handler = self.model_fn                  # 最里层:真正的模型调用
    for mw in reversed(self.middleware):
        handler = (lambda h, m: (lambda req: m.wrap_model_call(req, h)))(handler, mw)
    return handler
```

假设你注册了 `middleware = [LoggingMW, RetryMW]`,组装出来的调用链等价于:

```python
LoggingMW.wrap_model_call(
    request,
    handler = lambda req: RetryMW.wrap_model_call(
        req,
        handler = lambda req: 真正调用大模型API(req)
    )
)
```

画成图:

```
调用方向 →
┌─────────────── LoggingMW ───────────────┐
│  ┌──────────── RetryMW ─────────────┐   │
│  │                                  │   │
│  │        真正的 model_fn(request)   │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
响应方向 ←
```

**第一个 middleware 永远在最外层**——所以 `LoggingMW` 会最先看到"要发的请求",也最后看到"最终响应"。`wrap_tool_call` 的组装逻辑完全一样,只是包裹的是"执行某个工具"这个动作。

> 为什么要这样设计?因为有些逻辑(比如"记录耗时"、"失败重试"、"缓存结果")天然需要在调用前后各做一次事情,而普通的 before/after 钩子做不到"在调用前后共享同一个局部变量"或者"决定要不要真的调用下一层"。洋葱模型能做到这两点。

### 4.4 `hook_config`——声明"我允许跳到哪里"

```python
def hook_config(can_jump_to=None):
    def decorator(fn):
        fn._can_jump_to = 12 or []   # ⚠️ 这里有 bug,见下方说明
        return fn
    return decorator
```

设计初衷是:如果你的 middleware 想在 `before_model` 里 `return {"jump_to": "end"}`,必须先用装饰器声明:

```python
class MyMiddleware(AgentMiddleware):
    @hook_config(can_jump_to=["end"])
    def before_model(self, state, runtime=None):
        ...
        return {"jump_to": "end"}
```

这是一种"显式声明意图"的安全设计——防止某个 middleware 意外/悄悄地跳过了整个流程而没人知道。

> ⚠️ **这段代码里有一个明显的 bug**:
> ```python
> fn._can_jump_to = 12 or []
> ```
> 应该写成 `fn._can_jump_to = can_jump_to or []`。
> 在 Python 里 `12 or []` 的结果恒等于 `12`(因为 `12` 是真值,`or` 直接短路返回左边),跟你传的 `can_jump_to` 参数完全无关。
> 后果是:一旦真的触发 `jump_to`,`_check_jump_allowed` 里会执行 `"end" not in 12`,这会直接抛出
> `TypeError: argument of type 'int' is not iterable`,而不是按预期检查"end 是否在允许列表里"。
> **如果要实际使用这份代码,这一行必须修正。**

---

## 5. 执行顺序总览(文件开头注释的含义)

| 阶段 | 顺序 | 说明 |
|---|---|---|
| `before_agent` | 正序 | A→B→C,跑一次 |
| `before_model` | 正序 | 支持 `jump_to="end"` 短路 |
| `wrap_model_call` | 洋葱 | 第一个 middleware 最外层 |
| `after_model` | **反序** | C→B→A |
| `after_agent` | **反序** | C→B→A |

**为什么 after 要反序?**
把 before/after 也想象成洋葱的一部分就好理解了:A、B、C 三个中间件,进入顺序是 A→B→C,那么"退出"就该是 C→B→A,首尾对称,就像函数调用栈的入栈/出栈一样。

---

## 6. `invoke()` 主循环逐行讲解

```python
def invoke(self, initial_state):
    state = AgentState(initial_state)

    # ① before_agent,正序跑一遍,支持提前结束
    for mw in self.middleware:
        res = mw.before_agent(state)
        merge_state(state, res)
        if res and res.get("jump_to") == "end":
            return {...}

    for _ in range(self.max_iterations):
        # ② before_model,正序,可短路跳到 end
        ...

        # ③ 组装洋葱链,真正调用模型
        request = ModelRequest(messages=state["messages"], ...)
        response = self._build_model_chain()(request)
        merge_state(state, {"messages": [response]})

        # ④ after_model,反序
        ...

        # ⑤ 有 tool_calls 就执行工具,结果塞回 messages,continue 回到循环顶部
        if response.tool_calls:
            ... 执行工具(也走 wrap_tool_call 洋葱)...
            continue
        break   # 没有 tool_calls,说明模型给出了最终答案

    # ⑥ after_agent,反序
    ...
    return dict(state)
```

画成流程图:

```
                     before_agent(正序)
                            │
              ┌─────────────▼─────────────┐
              │      循环 max_iterations 次  │
              │                            │
              │   before_model(正序,可短路) │
              │            │               │
              │   wrap_model_call(洋葱)     │
              │      → 真正调用 LLM         │
              │            │               │
              │    after_model(反序)        │
              │            │               │
              │     模型返回 tool_calls?     │
              │       │是         │否       │
              │  执行工具(洋葱)   跳出循环    │
              │  结果塞进messages            │
              │       │                    │
              │  回到循环顶部(continue)      │
              └─────────────┬─────────────┘
                            │
                     after_agent(反序)
                            │
                          返回结果
```

这本质上就是常见的 **ReAct 循环**:模型思考 → 决定要不要用工具 → 用工具 → 把结果喂回去 → 模型继续思考 → 直到不再需要工具,或者达到 `max_iterations` 次数上限(防止死循环)。

---

## 7. 小结:如果你要自己写一个 Middleware

```python
class MyLoggingMiddleware(AgentMiddleware):
    def before_model(self, state, runtime=None):
        print(f"[准备调用模型] 当前消息数: {len(state.get('messages', []))}")
        return None   # 不需要改 state 就返回 None

    def wrap_model_call(self, request, handler):
        import time
        t0 = time.time()
        response = handler(request)
        print(f"[耗时] {time.time() - t0:.2f}s")
        return response
```

然后注册进 `create_agent`:

```python
agent = create_agent(
    model=my_model_fn,
    tools=[search_tool, calc_tool],
    system_prompt="你是一个助手",
    middleware=[MyLoggingMiddleware()],
)

result = agent.invoke({"messages": [HumanMessage("今天天气怎么样")]})
```

---

## 8. 建议的下一步练习

1. 自己写一个 `RetryMiddleware`,在 `wrap_model_call` 里捕获异常并重试 2 次。
2. 修复第 4.4 节提到的 `hook_config` bug,并写一个真正触发 `jump_to="end"` 的 middleware 验证修复效果。
3. 尝试给 `before_model` 加一个"如果消息数超过 20 条就跳到 end"的中间件,体会短路机制。