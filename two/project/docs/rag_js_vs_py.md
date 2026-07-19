# RAG 架构对比：LangChain.js vs LangGraph Python

在完成了核心的 `HybridRetrievalGraph` 从 TypeScript 迁移到 Python 的过程中，我们可以清晰地看到这两种技术栈和框架的异同。

## 1. 节点通信与状态管理 (State)

> **Python 的 `TypedDict` 更加灵活轻量**

* **TypeScript (LangChain.js)**: 使用 `Annotation.Root({...})` 来定义图的状态。这种做法很严谨，但也带来了比较繁琐的 API 签名。同时大量依赖 `Document` 类的实例化。
* **Python (LangGraph)**: 使用原生的 `TypedDict` 来管理状态（`HybridRetrievalState`）。不仅在节点函数中通过标准的字典操作（`state.get()` 和 `state["key"]`）即可获取，而且不需要把数据包装成庞大的 `Document` 类，直接操作扁平化的字典（`Dict[str, Any]`）大幅提升了处理性能。

## 2. 异步并发 (Async/Await)

* **TypeScript**: 强依赖 `Promise.all()` 和 `Array.prototype.flatMap()` 来实现多路并发召回：
  ```javascript
  const batches = await Promise.all(qs.map(q => esClient.search(...)));
  const flat = batches.flatMap(res => ...);
  ```
* **Python**: 对应的是 `asyncio.gather` 以及列表推导式：
  ```python
  batches = await asyncio.gather(*(fetch_es(q) for q in qs))
  flat = [doc for batch in batches for doc in batch]
  ```
  Python 的异步语法在处理这类 IO 密集型任务时同样非常优雅。

## 3. 图的流转编排 (Edges & Parallelism)

> **并发分支在两者中的表现**

* **TypeScript**: `addEdge(["es_recall", "milvus_recall"], "merge")` 允许一次性为多个上游节点指定同一个下游节点，非常简洁。
* **Python**: 需要分别显式添加连线，但逻辑更为明确：
  ```python
  workflow.add_edge("es_recall_agent", "merge_agent")
  workflow.add_edge("milvus_recall_agent", "merge_agent")
  ```
  两者在运行时都会自动识别 `query_agent` 的下游有两个分支，并**自动并发执行**这两个节点（即真正的多线程/协程并发召回）。

## 4. Rerank 重排的实现方式

* **TypeScript**: LangChain.js 社区有封装好的 `DashScopeRerank` 模块，可以直接当做一个工具类实例化。
* **Python**: 很多国内的大模型 API 在 LangChain 的 Python 官方包里更新不及时（或属于第三方扩展）。我们选择了**直接使用 `aiohttp` 裸调阿里云原生 API** 的方式。这种做法的好处是：**彻底摆脱了复杂的依赖地狱**，想传什么参数、想怎么处理错误，全部由我们自己掌控。

## 5. Prompt 的组装机制

* 两端惊人的一致！都使用了 `ChatPromptTemplate.from_messages()`，连里面嵌套的 `("system", "...")` 和 `("human", "...")` 语法都几乎一模一样。这也证明了掌握核心的 Prompt 编排理念，在任何语言中都是互通的。
