# RAG 模块与量化评测体系实战总结 (LangSmith & OpenEvals)

## 一、量化评测 (Quantitative Evaluation) 的核心策略

在构建基于大语言模型（LLM）的检索增强生成（RAG）应用时，如何客观、量化地衡量 RAG 系统的回答质量一直是个难题。单纯凭借肉眼看几个 Case 无法指导长期的优化迭代。因此，我们需要引入**LLM-as-a-Judge（大模型做裁判）**加上成熟的评测平台（如 LangSmith），来维持迭代的可预测性与准确性：

### 1. RAG 评测的三个核心维度

针对 RAG 场景，我们总结了行业内最通用的三大打分机制最佳实践（借助 `openevals` 库）：

- **`Groundedness` (忠实度)**：用来判断大模型的回答是否严格依据了检索出来的上下文（Context）。这是预防和评测**大模型幻觉（Hallucination）**最关键的指标。
- **`Helpfulness` (有用性)**：评估回答是否直接且有效地解答了用户的原始问题，是否切题、有没有答非所问或者废话连篇。
- **`Retrieval Relevance` (检索相关性)**：抛开大模型生成的文字，单独审视**向量数据库召回的片段**与用户提问的关联度。这对于调优 Embedding 模型、Chunking 策略以及向量距离算法至关重要。

---

## 二、步骤一：构建 RAG 图工作流 (LangGraph)

### 核心思路

在原有的 LCEL 链式调用之上，为了更好地解耦“检索”与“生成”步骤，我们推荐使用 `LangGraph` 来构建基于图节点（Node）的流转体系。配合 Python 的强类型特性，图的每一个状态都会变得极其可控。

### 关键代码

**文件**：`src/rag_demo/rag_agent.py`

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

# 定义强类型的状态空间
class GraphState(TypedDict):
    question: str
    context: str
    answer: str

# 节点 1: 检索 Node
async def retrieve(state: GraphState):
    vector_store = get_vector_store(collection_name="rag_docs")
    retriever = vector_store.as_retriever(search_kwargs={"k": 4})
    docs = await retriever.ainvoke(state["question"])
    # 也可以直接保留 Document 对象列表
    return {"context": docs}

# 节点 2: 生成 Node
async def generate(state: GraphState):
    context_text = "\n\n".join(doc.page_content for doc in state["context"])
    answer = await chain.ainvoke({
        "context": context_text,
        "question": state["question"]
    })
    return {"answer": answer}

# 组装图工作流
workflow = StateGraph(GraphState)
workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)
workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)
rag_app = workflow.compile()
```

### 适用场景

- 检索和生成需要独立追踪耗时的复杂 RAG 应用
- 需要在未来加入“循环校验”、“回退搜索”等多步推理编排的系统

---

## 三、步骤二：构建评测题库 (Dataset Generation)

### 核心思路

题库是量化评测的基石。在测试开始前，我们需要向 LangSmith 平台批量注入（或拉取）包含“原始问题 (Input)”与“预期答案 (Output)”的静态数据集合。

### 关键代码

**文件**：`src/rag_demo/eval/build_dataset.py`

```python
from langsmith import Client

DATASET_NAME = "rag-eval-v1"
client = Client() # 自动读取环境变量 LANGSMITH_API_KEY

EXAMPLES = [
    {
        "inputs": {"question": "无理由退货要在几天内申请？"},
        "outputs": {"answer": "自签收之日起 7 天内支持无理由退货。"},
    },
    # ... 其他几十上百条回归测试集
]

# 如果不存在则创建数据集
if not client.has_dataset(dataset_name=DATASET_NAME):
    dataset = client.create_dataset(
        dataset_name=DATASET_NAME,
        description="RAG Agent 回归评估集",
    )

# 批量写入题库样例
client.create_examples(
    inputs=[e["inputs"] for e in EXAMPLES],
    outputs=[e["outputs"] for e in EXAMPLES],
    dataset_id=dataset.id,
)
```

---

## 四、步骤三：配置 OpenEvals 裁判指标 (Evaluators)

### 核心思路

利用 `openevals` 提供的标准官方提示词模板（Prompt），将一个大模型包装成一个冷酷无情的裁判员。对于 RAG 任务，我们需要创建三个不同的法官，并在外部封装一层适配器，使其完美兼容 LangSmith SDK 传入的 `run` (本次运行结果) 和 `example` (题库标准答案)。

### 关键代码

**文件**：`src/rag_demo/eval/evaluators.py`

```python
from openevals.llm import create_async_llm_as_judge
from openevals.prompts import (
    RAG_GROUNDEDNESS_PROMPT,
    RAG_HELPFULNESS_PROMPT,
    RAG_RETRIEVAL_RELEVANCE_PROMPT,
)

# 生成一个检测忠实度的 LLM 裁判
rag_groundedness_judge = create_async_llm_as_judge(
    prompt=RAG_GROUNDEDNESS_PROMPT,
    feedback_key="rag_groundedness",
    judge=default_model,
    continuous=True,
)

# 适配器：将 LangSmith 运行时参数解构，塞入 OpenEvals
async def rag_groundedness_evaluator(run, example=None):
    outputs = run.outputs or {}
    return await rag_groundedness_judge(
        context={"documents": outputs.get("context", [])},
        outputs={"answer": outputs.get("answer", "")},
    )

rag_evaluators = [
    rag_groundedness_evaluator,
    # ... 其他两个 evaluator 封装类似
]
```

### 参数说明

| 核心组件 | 作用 |
|---|---|
| `prompt` | OpenEvals 官方长期调优、专门用于各种检测目标的 Prompt 预设 |
| `feedback_key` | 将打分上报给 LangSmith 平台时的展示标签（如 `rag_groundedness`） |
| `continuous=True` | 让裁判给出连续分数（如 0.0 到 1.0 的浮点数），而不是简单的 0/1 |
| `run.outputs` | 被测试的 RAG 应用单次跑出来的实际结果（如生成的 answer 和召回的 context） |

---

## 五、步骤四：一键执行量化自动化评测 (Run Evaluation)

### 核心思路

一切就绪后，我们使用 LangSmith 提供的 `aevaluate` 方法，将**题库数据集**、**待测试目标 (Target Function)** 以及**裁判员数组 (Evaluators)** 三方聚拢。SDK 会自动并发遍历题库中的每一个问题，请求目标 Agent，并将结果并行分发给多个裁判打分，最终生成一张可视化报告。

### 关键代码

**文件**：`src/rag_demo/eval/run_eval.py`

```python
import asyncio
from langsmith.evaluation import aevaluate
from rag_demo.rag_agent import ask
from rag_demo.eval.evaluators import rag_evaluators

# 被评测的目标包裹函数：处理出入参，向裁判暴露出答卷
async def run_rag_agent(inputs: dict) -> dict:
    result = await ask(inputs["question"])
    return {
        "answer": result["answer"],
        "context": [doc.page_content for doc in result.get("context", [])]
    }

async def main():
    # 开始云端并发评测
    result = await aevaluate(
        run_rag_agent,
        data="rag-eval-v1",              # 题库名
        evaluators=rag_evaluators,       # 裁判数组
        experiment_prefix="rag-eval",    # 实验名前缀，便于追踪
        max_concurrency=2,               # 控制并发请求速率
    )
    print("✅ 评测完成")
    print(f"报告: https://smith.langchain.com/o/default/projects/p/chat")

asyncio.run(main())
```

### 实际运行结果

```text
0it [00:00, ?it/s]
...
12it [05:05, 25.45s/it]

✅ 评测完成
实验名: rag-eval-qwen3.7-plus-68aa36c6
指标: rag_groundedness | rag_helpfulness | rag_retrieval_relevance
```

### 💡 进阶避坑技巧：环境变量注入与包名冲突

1. **避免与官方包同名**：千万不要将业务目录命名为 `langsmith`，否则会导致 Python 导包时将当前目录和 pip 安装的 `langsmith` 库发生严重冲突（引发 `ModuleNotFoundError`）。正确的做法是改名为如 `rag_demo`，并从根目录发起规范导入（`from rag_demo.rag_agent import ask`）。
2. **底层环境变量读取**：许多 SDK 底层强制读取 `os.environ`。如果单纯使用 `pydantic-settings` 解析 `.env`，会导致环境变量只留在内存对象里。进行自动化评测时，强烈建议使用 `dotenv.load_dotenv()` **真实且暴力**地将 `.env` 注入系统底层环境变量，以防抛出鉴权失败 (`Invalid token`)。

---

## 六、学习与实践推荐

在学习和实践检索增强生成（RAG）以及量化评测体系的过程中，向量库的召回能力（Retrieval Relevance 评分的核心）至关重要。

为了免去本地繁琐的向量数据库部署、索引调优与环境配置环节，快速跑通如上的完整大模型应用评测流水线，**强烈推荐大家使用 [Zilliz Cloud](https://zilliz.com/cloud) 来进行开发与验证**。作为 Milvus 的原厂全托管云服务，它提供了极为强大的扩展性和易用性，能够让你把更多精力专注在 Prompt 调优和 RAG 图工作流编排上，是打造生产级企业知识库不可多得的利器。
