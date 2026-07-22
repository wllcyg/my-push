# DeepAgents Core 核心 API 指南

`deep_agents.core` 包含了框架的 Agent 工厂构建引擎与子 Agent 高并发任务调度器。

导入路径：
```python
from deep_agents import create_agent, create_subagent_tools
```

---

## 1. `create_agent`

`create_agent` 是框架的核心 Agent 工厂函数。它基于 LangGraph 构建 ReAct 思考与工具调用图。

### 函数签名

```python
def create_agent(
    llm: Any, 
    tools: List[Any], 
    system_prompt: str = "", 
    response_schema: Optional[Type[BaseModel]] = None,
    max_context_messages: int = 30
) -> CompiledGraph
```

### 参数详解

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :---: | :---: | :--- |
| `llm` | `BaseChatModel` | **是** | - | LangChain 兼容的 LLM 实例（如 ChatOpenAI）。 |
| `tools` | `List[BaseTool]` | **是** | - | 绑定的工具函数列表。 |
| `system_prompt` | `str` | 否 | `""` | 系统提示词，自动置顶保活。 |
| `response_schema` | `Type[BaseModel]` | 否 | `None` | Pydantic 模型。若传入，自动启用**两阶段硬约束格式化**。 |
| `max_context_messages` | `int` | 否 | `30` | 上下文历史消息最大保留条数，超出的对话记录将被滑动裁剪。 |

### 代码示例：基础 ReAct Agent

```python
from deep_agents import create_agent
from deep_agents.tools import web_search
from modules.core.llm import default_model

agent = create_agent(
    llm=default_model,
    tools=[web_search],
    system_prompt="你是一名搜索助手。",
    max_context_messages=20
)

# 异步调用
res = await agent.ainvoke({"messages": [("human", "北京天气怎么样？")]})
print(res["messages"][-1].content)
```

### 两阶段硬约束输出（`response_schema`）

当传入 `response_schema` 时，`create_agent` 会在 ReAct 循环结束后自动挂载 `formatter` 节点，使用 `with_structured_output` 提炼 100% 格式化的 Pydantic 数据：

```python
from pydantic import BaseModel, Field

class UserReport(BaseModel):
    summary: str = Field(description="核心摘要")
    keywords: list[str] = Field(description="关键词列表")

agent = create_agent(
    llm=default_model,
    tools=[web_search],
    response_schema=UserReport
)

res = await agent.ainvoke({"messages": [("human", "总结 AI 发展趋势")]})
# 从 state 结构化字段中获取 Pydantic 对象
report: UserReport = res["structured_response"]
```

---

## 2. `create_subagent_tools`

`create_subagent_tools` 用于生成主 Agent（Orchestrator）委派任务给子 Agent 的调度工具组。

### 函数签名

```python
def create_subagent_tools(subagents: Dict[str, Any]) -> List[BaseTool]
```

### 参数与返回值

- **参数 `subagents`**：字典映射，`Key` 为子 Agent 的名称标识，`Value` 为由 `create_agent` 创建的子 Agent 图实例。
- **返回值**：包含 `[delegate_task, delegate_tasks_parallel]` 两个 Tool 的列表。

### 工具说明

1. **`delegate_task(subagent_type, query)`**：
   - 串行委派单个任务给指定的子 Agent。
2. **`delegate_tasks_parallel(tasks)`**：
   - **高并发并行委派工具**。接收一个字典数组 `[{"subagent_type": "...", "query": "..."}, ...]`，底层使用 `asyncio.gather` 同时并发唤醒多个子 Agent 进行多路并行处理。

### 代码示例

```python
from deep_agents import create_agent, create_subagent_tools

# 1. 定义子 Agent
researcher_agent = create_agent(llm, tools=[web_search], system_prompt="调研员...")
analyst_agent = create_agent(llm, tools=[python_repl], system_prompt="分析师...")

# 2. 生成调度工具组
subagent_tools = create_subagent_tools({
    "researcher": researcher_agent,
    "analyst": analyst_agent
})

# 3. 挂载给主 Agent
orchestrator_agent = create_agent(
    llm=default_model,
    tools=subagent_tools,
    system_prompt="你是主协调 Agent，推荐优先使用 delegate_tasks_parallel 进行并行委派！"
)
```
