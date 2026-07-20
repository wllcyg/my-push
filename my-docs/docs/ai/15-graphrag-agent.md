# GraphRAG Agent：基于图数据库的智能问答实战总结
![image](https://api.cheatppf.xyz/i/mrsjx4o9-pjodvj.png)
## 一、架构概述 (Architecture Overview)

在面对特定垂直领域的知识问答（如奶茶配方、成分、工艺等）时，传统的基于向量检索的 RAG（Retrieval-Augmented Generation）往往难以处理复杂的多跳实体关系。**GraphRAG** 通过引入知识图谱（如 Neo4j）作为外部知识库，利用大模型生成图查询语言（Cypher），能够精准提取结构化关联数据。

本指南基于 LangGraph 框架，展示了如何构建一个线性的 GraphRAG 工作流。

---

## 二、状态定义 (Graph State)

在 LangGraph 中，我们需要定义一个状态对象（State）在各个节点（Node）之间流转。

**关键代码**：

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class GraphState(TypedDict):
    """
    代理的状态定义，记录每次对话过程中的中间结果
    """
    messages: Annotated[list, add_messages] # 对话历史与当前消息
    query: str                              # 提取出的用户问题
    cypher: str                             # 大模型生成的 Cypher 语句
    context: str                            # 从图数据库中检索到的上下文结果
    answer: str                             # 最终生成的面向用户的回答
```

---

## 三、核心工作流节点 (Nodes)

GraphRAG 的核心处理流程拆分为 4 个明确的步骤节点：

### 1. 解析问题 (`parse_question`)
从对话消息队列中提取出用户最新的一句话，作为本次查询的核心 `query`。

```python
async def parse_question(state: GraphState) -> dict:
    last_message = state["messages"][-1]
    return {"query": last_message.content}
```

### 2. 生成图谱查询语句 (`generate_cypher`)
这是 GraphRAG 最关键的步骤之一。通过 Prompt 注入图谱的 Schema（实体类型与关系方向），引导大模型（LLM）将自然语言问题转化为精确的 Cypher 查询语言。

> **最佳实践 (Prompt 设计要点)**：
> - 明确列出节点类型（如 Product, Ingredient, Type）及核心关系方向（如 `(Product)-[:包含]->(Ingredient)`），强调**关系方向绝对不能反**。
> - 要求返回查询链路中涉及的**所有关键节点属性**，而不仅仅是单个节点，保证下一步有足够的上下文信息。
> - 约束输出格式为纯 Cypher 代码。

```python
async def generate_cypher(state: GraphState) -> dict:
    prompt = f"""...Prompt 模板..."""
    res = await default_model.ainvoke([HumanMessage(content=prompt)])
    return {"cypher": res.content}
```

### 3. 执行图谱查询 (`execute_graph_query`)
将生成的 Cypher 语句发往 Neo4j 数据库执行，并捕获执行结果。

> **容错处理**：大模型生成的 Cypher 可能存在语法错误或查询不到结果的情况。必须进行 `try-except` 异常捕获，避免整个 Agent 崩溃，并在异常时返回默认上下文。

```python
async def execute_graph_query(state: GraphState) -> dict:
    try:
        res = graph.query(state["cypher"])
        return {"context": json.dumps(res, ensure_ascii=False)}
    except Exception as e:
        return {"context": '未查询到相关知识'}
```

### 4. 生成最终答案 (`generate_answer`)
将用户问题（`query`）和图谱检索结果（`context`）一并交给 LLM，生成最终的自然语言回答。

> **防止幻觉**：在 Prompt 中严格要求 LLM 仅根据「检索结果」回答，不得编造图谱中未出现的实体。

```python
async def generate_answer(state: GraphState) -> dict:
    prompt = f"""...Prompt 模板..."""
    res = await default_model.ainvoke([HumanMessage(content=prompt)])
    return {"answer": res.content}
```

---

## 四、图谱流转编排 (Edges & Workflow)

使用 LangGraph 的 `StateGraph` 将上述独立的节点串联成完整的线性工作流：

```python
from langgraph.graph import StateGraph, START, END

# 1. 初始化图状态
workflow = StateGraph(GraphState)

# 2. 注册节点
workflow.add_node("parse_question", parse_question)
workflow.add_node("generate_cypher", generate_cypher)
workflow.add_node("execute_graph_query", execute_graph_query)
workflow.add_node("generate_answer", generate_answer)

# 3. 定义流转边 (严格的线性执行)
workflow.add_edge(START, "parse_question")
workflow.add_edge("parse_question", "generate_cypher")
workflow.add_edge("generate_cypher", "execute_graph_query")
workflow.add_edge("execute_graph_query", "generate_answer")
workflow.add_edge("generate_answer", END)

# 4. 编译应用
app = workflow.compile()
```

---

## 五、实际运行与调试技巧

在实际开发中，我们需要对黑盒中间过程进行可视化调试。代码中在 `while` 交互循环里打印了中间状态，这是非常重要的调试手段：

```python
# 运行图谱工作流
final_state = await app.ainvoke(initial_state)

# 打印调试信息，验证大模型的 Text-to-Cypher 能力
print(f"🔧 [调试信息] 提取的 Query: {final_state.get('query')}")
print(f"🔧 [调试信息] 生成的 Cypher: \n{final_state.get('cypher')}")

# 输出结果
print(f"🤖 奶茶专家: {final_state.get('answer')}")
```

### GraphRAG 与传统 RAG 的适用场景对比

| 对比维度 | 传统 Vector RAG | GraphRAG |
|---|---|---|
| **核心机制** | 语义相似度匹配（余弦相似度） | 大模型生成图查询语句 (Text-to-Cypher) |
| **优势** | 适合非结构化文档、长文本、通用知识问答 | 适合具有明确实体关联、多跳逻辑推理、结构化知识场景 |
| **难点** | 块(Chunk)的切分策略、丢失整体逻辑联系 | 需要高质量图谱构建、极度依赖 LLM 生成 Cypher 的准确率 |
| **典型示例** | “请总结一下这份 PDF 的内容” | “这款含有珍珠的奶茶适合哪些人群喝？” |

对于高度关联的垂直知识领域，引入知识图谱能够极大降低 AI 产生的“幻觉”，从而提供确定性极高的精确解答。
