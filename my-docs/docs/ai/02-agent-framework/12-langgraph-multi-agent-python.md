# LangGraph 多智能体踩坑记：生产环境为什么一定要“徒手撕” Supervisor？

最近在用 LangGraph Python 版重构一个多智能体（Multi-Agent）项目。起初觉得照着官方文档调几个高层 API 就能轻松搞定，结果真上手才发现处处是坑，尤其是极其混乱的参数版本迭代和完全“放养”的底层路由封装。

深入翻了底层的源码后，我才领悟到 LangGraph 官方的良苦用心：**在真正的生产环境里，过度依赖黑盒封装的 Agent 往往是灾难的开始。**

先从最基础的图结构讲起，再循序渐进讲到多智能体的核心踩坑。

---

## 前置基础：LangGraph 图的两大核心逻辑节点

在 LangGraph 中，整个 AI 工作流本质上是一张**有向状态图（Directed State Graph）**。它有且仅有两种“流程控制”能力：**条件路由（判断）** 和 **自循环（循环重试）**，对应了编程里的 `if-else` 和 `while`。

### 条件路由：图里的 if-else

最常见的场景：用户的输入需要被分类，然后转发到不同的处理节点。这就是 `add_conditional_edges` 的核心使用场景。

![条件路由示例](https://api.cheatppf.xyz/i/mrq1ulqg-oe3gz7.png)

**代码示例**（`conditional-routing.py`）：

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
import re

class State(TypedDict):
    query: str
    route: str  # 路由结果写入状态，供下游节点读取
    answer: str

# 1. 路由节点：根据输入决定走哪条边
def router(state: State) -> dict:
    is_math = bool(re.search(r"[+\-*/]", state["query"]))
    return {"route": "math" if is_math else "chat"}

def math_node(state: State) -> dict:
    return {"answer": str(eval(state["query"]))}  # 仅作演示，生产环境禁止用 eval

def chat_node(state: State) -> dict:
    return {"answer": f"你说的是：{state['query']}"}

workflow = StateGraph(State)
workflow.add_node("router", router)
workflow.add_node("math_node", math_node)
workflow.add_node("chat_node", chat_node)
workflow.add_edge(START, "router")

# 2. 关键：根据 state["route"] 的值，决定跳到哪个节点
workflow.add_conditional_edges(
    "router",
    lambda state: state["route"],  # 这行是灵魂：条件判断函数
    {
        "math": "math_node",
        "chat": "chat_node",
    }
)
workflow.add_edge("math_node", END)
workflow.add_edge("chat_node", END)

graph = workflow.compile()
```

这里有个初学者最容易犯的设计错误：把“条件判断逻辑”写进下游节点里，而不是在路由节点里集中处理。正确的做法是：**路由节点只负责写入路由结果到 State，边（Edge）负责分发，下游节点只负责纯粹的业务逻辑。** 职责分离是图结构可维护的核心。

### 自循环：图里的 while 循环

LangGraph 里实现循环的方式极其优雅——**让条件边指向自身节点**。

经典场景：模拟“自动重试”，直到满足特定条件才退出循环。

![循环重试示例](https://api.cheatppf.xyz/i/mrq1vps9-b5jhzb.png)

**代码示例**（`loop-retry.py`）：

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    tries: int
    ok: bool
    message: str

def attempt_node(state: State) -> dict:
    tries = state.get("tries", 0) + 1
    ok = tries >= 3  # 第 3 次才算成功
    message = f"第 {tries} 次成功" if ok else f"第 {tries} 次失败，继续重试"
    return {"tries": tries, "ok": ok, "message": message}

workflow = StateGraph(State)
workflow.add_node("attempt", attempt_node)
workflow.add_edge(START, "attempt")

# 关键：让条件边的 "retry" 分支指向自身，形成循环！
workflow.add_conditional_edges(
    "attempt",
    lambda state: "done" if state.get("ok") else "retry",
    {
        "retry": "attempt",  # 👈 指回自身，这就是循环的本质
        "done": END
    }
)

graph = workflow.compile()
result = graph.invoke({"tries": 0, "ok": False, "message": ""})
# 输出: {'tries': 3, 'ok': True, 'message': '第 3 次成功'}
```

注意 `"retry": "attempt"` 这一行——这就是 LangGraph 实现循环的全部秘密。它不需要任何特殊的 `while` 语法，只是把一条条件边的目标节点指向了同一个节点自身，图的运行引擎会自动处理这个环路。

---

## 踩坑 1：变幻莫测的 `create_react_agent` 参数

在封装单个智能体时，我们通常会用到 `langgraph.prebuilt` 里的 `create_react_agent`。我在照搬一些早期的官方示例，往里面传 `messages_modifier` 注入系统提示词时，代码直接甩了我一个无情的报错：

```bash
TypeError: create_react_agent() got unexpected keyword arguments: {'messages_modifier': ...}
```

**排查过程**：
我起初以为是简单的版本兼容问题，改成网贴里说的 `state_modifier` 依然报错。被逼无奈直接点进虚拟环境里的 `chat_agent_executor.py` 源码，才发现了一个令人啼笑皆非的事实。

因为 LangGraph Python 团队目前处于极度高频的迭代期，这个用来改 prompt 的核心参数在短时间内反复横跳，最后在当前的特定版本里，它被精简成了最直白的 `prompt`。

```python
# 改前：跟着老教程写，直接报错
graph = create_react_agent(
    default_model,
    tools=[get_product_stock],
    messages_modifier="你是仓库助手...",
)

# 改后：顺应当前源码，完美跑通
graph = create_react_agent(
    default_model,
    tools=[get_product_stock],
    prompt="你是仓库助手...",  # 对，现在它就叫 prompt
    checkpointer=memory
)
```

## 踩坑 2：到处找不到的“一键路由”封装

解决了单点 Agent，重头戏来了。我们需要一个“调度员”（Supervisor）来统筹大局，比如遇到问天气的交派给 `weather_agent`，问知识的交派给 `trivia_agent`。

网上很多所谓的“多智能体框架”都会提供一个类似 `create_supervisor` 的一键魔法函数。但我翻遍了 `langgraph.prebuilt`，硬是没找到这样一个官方的高层封装。官方仅仅在偏僻的教程里扔了一段长长的脚手架代码，让你自己去画节点。为什么官方不愿意提供一个开箱即用的黑盒路由？

**原理解析**：
其实所谓的 Supervisor 路由，底层只干两件事：
1. **结构化输出**：强制大模型只能输出子代理的名字，绝不能废话。
2. **条件路由**：根据这个输出，决定下一步图（Graph）的游走方向。

如果官方给你提供一个黑盒的路由封装，一旦你需要拦截特定节点（比如在某个 Agent 执行前加个人工审批流），或者希望子图执行完后直接结束而不返回给调度员，这个黑盒就彻底改不动了。Python 社区崇尚“白盒明言”（Explicit is better than implicit），干脆让你自己利用状态机（StateGraph）亲手画这张图。

## 解决方案：自己动手封装一个极简 Supervisor

既然懂了原理，与其满世界找所谓的“开箱即用”框架，不如我们自己利用 LangGraph 的底层算子搓一个通用的 `create_supervisor` 函数。

核心思路就是利用 Pydantic 和大模型的 `with_structured_output` 强迫它做单选题，然后配上图的路由逻辑：

```python
from langgraph.graph import StateGraph, START, END, MessagesState
from pydantic import BaseModel, Field

def create_supervisor(model, agents: dict, prompt: str):
    members = list(agents.keys())
    options = members + ["FINISH"]

    # 1. 动态生成 Schema，强制 LLM 做选择题
    class RouteSchema(BaseModel):
        next: str = Field(description=f"决定下一步交由谁处理，可选值必须精确匹配: {', '.join(options)}")

    supervisor_chain = model.with_structured_output(RouteSchema)
    
    class SupervisorState(MessagesState):
        next: str

    # 2. 定义调度节点
    async def supervisor_node(state: SupervisorState):
        messages = [{"role": "system", "content": prompt}] + state.get("messages", [])
        response = await supervisor_chain.ainvoke(messages)
        # 兜底机制：如果模型抽风瞎编，强行阻断
        next_node = response.next if response.next in options else "FINISH"
        return {"next": next_node}

    # 3. 组装图节点与边
    workflow = StateGraph(SupervisorState)
    workflow.add_node("supervisor", supervisor_node)
    
    # 动态把传进来的 agents 全挂载上去
    for name, agent in agents.items():
        # 注意：这里要用默认参数 current_agent=agent 锁定闭包环境
        async def call_agent(state: SupervisorState, current_agent=agent):
            result = await current_agent.ainvoke(state)
            return {"messages": result["messages"][-1]}
            
        workflow.add_node(name, call_agent)
        # 灵魂一步：子节点干完活必须向调度员汇报，形成环路
        workflow.add_edge(name, "supervisor") 

    workflow.add_edge(START, "supervisor")
    
    # 配置条件路由表
    route_map = {m: m for m in members}
    route_map["FINISH"] = END
    workflow.add_conditional_edges("supervisor", lambda state: state["next"], route_map)

    return workflow.compile()
```

把这段逻辑单独抽离成 `graph_utils.py` 之后，我们在业务侧调用时，开发体验极其清爽：

```python
from modules.graph.graph_utils import create_supervisor

graph = create_supervisor(
    model=default_model,
    agents={
        "weather_agent": weather_agent,
        "trivia_agent": trivia_agent
    },
    prompt="你是调度员，只负责选人..."
)
```

## 踩坑 3：记忆串台与 Checkpointer 的多租户隔离

在解决完多节点路由后，我们需要让 Agent 拥有记忆。官方文档里轻描淡写地说在 compile 里加上 `checkpointer=MemorySaver()` 就行了。但如果你直接照抄放入后端的 Web API 中，立刻就会遇到灾难级 Bug：**所有用户的聊天记录全部串台了**。

**原理解析**：
LangGraph 的图状态（State）本质上是基于 `thread_id` 进行沙盒隔离的。一旦你启用了 Checkpointer，如果你在触发运行（invoke）时不显式声明 `thread_id`，它要么直接报错，要么所有请求都覆盖到同一个默认沙盒里。

**解决方案**：
在执行阶段（`invoke` 或 `astream`），你必须强行注入一个含有 `thread_id` 的 `config` 字典。

```python
from langgraph.checkpoint.memory import MemorySaver

# 1. 编译时绑定 Checkpointer
memory = MemorySaver() # 生产环境换成 SqliteSaver 或 RedisSaver
graph = workflow.compile(checkpointer=memory)

# 2. 运行时必须传入 thread_id！这是多租户隔离的命脉！
config = {"configurable": {"thread_id": "user_12345_session_1"}}
inputs = {"messages": [("user", "我的名字是小明")]}

# 必须把 config 传进去，否则绝对串台
async for event in graph.astream(inputs, config=config, stream_mode="values"):
    pass
```

## 踩坑 4：僵硬的旧版拦截，与全新的 `interrupt()` API

在真实的业务工作流中，不可避免地会有“人类审批流”（Human-in-the-loop）。比如：在 Agent 决定调用付款工具、或发送重要邮件前，必须让前端弹出对话框，人类点个“同意”才能往下走。

如果你去搜以前的技术文章，大家都在教你怎么在特定节点抛出异常，或者在编译时用死板的 `interrupt_before=["tool_node"]`。但这些做法极度僵硬，很难处理动态生成的逻辑。

好在最新的 LangGraph 中，官方终于放出了真正的王炸 API：`interrupt()` 和 `Command(resume=...)`。

**解决方案**：
直接在普通的 Node 内部调用 `interrupt()`。代码执行到这里会**瞬间挂起**，底层会将当前的执行栈、变量数据全部封存进 Checkpointer，然后终止运行。直到外部用 `Command` 发送指令恢复。

```python
from langgraph.types import interrupt, Command

# 1. 在节点内部触发人工拦截
def human_approval_node(state: SupervisorState):
    # 流程走到这里自动挂起，把后面的字符串抛给前端
    user_decision = interrupt("检测到高危操作（发送营销邮件），请审批！")
    
    # 只有被外力唤醒后，才会继续执行下面的代码
    if user_decision == "同意":
        return {"messages": ["审批通过，邮件已发送"]}
    return {"messages": ["审批被拒，流程终止"]}

# 2. 从外部唤醒（恢复）被拦截的图
# 假设前端用户点击了同意，再次调用后端图
result = graph.invoke(
    # 用 Command 的 resume 属性塞入前端传回来的审批结果
    Command(resume="同意"), 
    # 必须带着刚才那个被挂起的 thread_id！
    config={"configurable": {"thread_id": "user_12345_session_1"}}
)
```

这种 API 设计才是真正的状态机之美——**图的暂停与恢复彻底解耦**。无论过了多长时间（哪怕服务器重启过），只要拿着对应的 `thread_id` 和 `resume` 信号，代码就能从断点处严丝合缝地继续跑下去！

## 总结

这次用 LangGraph Python 版徒手搭建全栈多智能体的折腾，进一步印证了开发复杂 AI 应用的几条铁律：

1. **别太迷信高层 API 黑盒**。大模型框架还在剧烈迭代，过早依赖语法糖，在排错时成本极高。
2. **状态机（StateGraph）才是王道**。不管顶层包了多少层概念，底层全都是 `StateGraph`、`add_node` 和 `add_conditional_edges`。
3. **掌控全局控制权**。当我们亲手撕了路由调度策略，并融合了基于 `thread_id` 的多租户持久化、以及极度优雅的 `interrupt()` 人工拦截机制后，一个真正面向生产环境（容错、可暂停、多租户隔离）的现代 AI 架构才算正式成型。
