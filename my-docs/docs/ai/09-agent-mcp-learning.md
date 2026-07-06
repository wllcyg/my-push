# Agent 工具调用核心原理与 MCP 接入实战总结

![首图](https://api.cheatppf.xyz/i/mr8ts338-wna0lm.png)

本文档总结了如何基于 LangChain 框架构建带有外部工具调用能力的 AI Agent，并重点探讨了如何接入 MCP (Model Context Protocol) 服务以及使用 LCEL (LangChain Expression Language) 编排复杂的执行流。通过 Agent 与工具的结合，我们可以突破大模型本身的信息孤岛，让其具备与真实世界交互（如查询地图、执行代码）的能力。

---

## 一、核心架构：Agent 的执行逻辑与 LCEL 编排

与传统的单向对话或纯 RAG 检索不同，Agent 拥有“自主决策”的能力。它的标准工作流通常包含一个基于状态的循环：

- **大模型思考 (Thinking)**：将用户问题和上下文交由大模型，大模型决定是直接给最终回答，还是需要调用特定的外部工具。
- **工具路由 (Routing)**：代码需要捕获模型给出的 `tool_calls` 信号，进入工具执行的分支逻辑。
- **工具执行 (Execution)**：调用本地或远程的工具接口（如 MCP 服务），获取真实的业务数据。
- **结果观察 (Observation)**：将工具返回的数据包装回传给大模型，供其进行二次思考和总结。

在实战中，我们使用 **LCEL (LangChain Expression Language)** 来声明式地编排上述复杂的循环与条件分支逻辑。

---

## 二、关键组件选型与实战解析

### 1. 接入 MCP 服务获取标准工具

MCP (Model Context Protocol) 提供了一种标准化的方式来让大模型连接各种外部数据和服务。在本项目中，我们实战了通过 MCP 接入高德地图的能力。

- **MultiServerMCPClient**：我们利用 `@langchain/mcp-adapters` 初始化客户端，通过 HTTP 连接到了高德的 MCP 节点。这样，无需我们手写繁琐的 API 请求封装代码，大模型就能直接“发现”并使用高德提供的地理编码或周边搜索等专业地图工具。
- **工具与模型绑定**：通过 `mcpClient.getTools()` 异步获取可用工具列表后，使用 `model.bindTools(tools)` 这一关键步骤，将外部能力（Schema）注入到大模型的知识体系中。

### 2. 构建核心工具执行器 (Tool Executor)

当大模型决定调用工具时，它只会返回工具的名称和参数。我们需要一个执行器来真正跑通这个调用链路。

- **查找与匹配**：在自定义的 `RunnableLambda` 中，我们遍历大模型返回的 `tool_calls` 数组，在预初始化的 `tools` 列表中寻找对应的具体工具实例 (`t.name === toolCall.name`)。
- **执行与包装**：执行 `findTool.invoke(toolCall.args)` 获取真实结果后，**必须**将其格式化为标准的规范。在 LangChain 体系下，我们将执行结果包装为 `ToolMessage` 传回上下文。如果不这么做，大模型在后续判断时将会报错或迷失上下文。

```typescript
// 规范的 ToolMessage 包装示例
toolResults.push(new ToolMessage({
  content: contenStr, // 工具返回的字符串化数据
  tool_call_id: toolCall.id // 必须与大模型的调用 ID 一一对应
}))
```

### 3. LCEL 分支路由：RunnableBranch 与状态管理

在纯 LCEL 架构下处理 Agent 循环，最核心的难点在于**条件分支的解耦**。

![流程图](https://api.cheatppf.xyz/i/mr8tsa72-iinc89.png)

- **条件分支判定**：我们使用了 LCEL 的 `RunnableBranch`。它的逻辑声明非常清晰：通过一个判断函数检查大模型返回的数据中是否包含工具调用请求 (`!state.response.tool_calls || state.response.tool_calls.length === 0`)。
- **结束分支**：如果判断为真（即无需调用工具），说明大模型已经推导出了最终答案。此时只需将结果存入 `messages`，并标记核心状态 `done: true` 以通知外层系统中断执行。
- **继续分支（默认）**：如果判断为假（即需要调用工具），则通过组合 `RunnableSequence` 依次执行：将模型的工具调用指令压入历史 -> 触发 `toolExecutor` 获取外部数据 -> 将工具结果一并压入历史 -> 标记 `done: false` 以便外层循环继续运转。

### 4. 复杂业务流编排对比：RAG 与 Agent

通过对比我们实现的《长安的荔枝》小说 RAG 检索（`book.ts`）和地图工具 Agent（`map.ts`），可以清晰看到 LCEL 在不同场景下表现出的不同流派：

- **线性流水线 (RAG 单次通过)**：在小说检索实战中，我们只需使用 `RunnableSequence` 串联起 `milvusSearch` -> `buildPrompt` -> `model` -> `StringOutputParser`。这是一条单向通行的高速公路，一环扣一环，只需 `invoke` 或 `stream` 一次即可闭环。
- **状态机循环 (Agent 多次迭代)**：在处理工具调用时，流程变得不再线性。我们需要在代码的最外层维护一个包含 `messages` 和 `done` 的全局 `state`。通过外层 `for` 循环（设定最大迭代次数如 `maxInterations = 30`）来不断驱动内部的 LCEL 路由网络，直到状态转变为结束。这不仅解决了多轮推导的问题，也有效防止了模型因无法理解工具而陷入无限死循环的风险。
