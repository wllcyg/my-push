# RAG 模块与量化评测体系架构指南 (rag_demo)

本文档整理了我们项目中 `rag_demo` 文件夹下构建的一整套基于大模型的检索增强生成 (RAG) 和量化自动化评测体系。该体系由原先的 TypeScript/JavaScript 逻辑完整无缝重构为 Python 异步流程，并集成了 LangChain, LangGraph, Milvus 以及 LangSmith OpenEvals。

## 核心架构与文件概览

`rag_demo` 目录下包含以下核心组件：

1. **`insert_data.py` - 向量化入库脚本**
   负责将业务原始数据（例如退换货规则、邮费等）进行向量化（Embedding），并写入到基于 Zilliz/Milvus 的 `rag_docs` 集合中。
2. **`rag_agent.py` - 检索生成工作流 (LangGraph)**
   构建了标准的图节点工作流，包含 `retrieve` (召回节点) 与 `generate` (生成节点)。采用 `langgraph.graph.StateGraph`，定义了包含 `question`, `context`, `answer` 的强类型图状态（`GraphState`）。对外暴露了异步的 `ask()` 方法。
3. **`test_rag.py` - 命令行沙盒自测**
   本地提供给开发者的测试入口。支持传入问题数组并批量发起询问，同时高亮打印出召回的原始文档片段，用于直观地判断基础检索效果。
4. **`eval/build_dataset.py` - 评测题库构建**
   与 LangSmith 平台联动，自动化构建或拉取名为 `rag-eval-v1` 的数据集，将标准问答（QA）测试用例写入其中，用作回归测试和量化打分的基础。
5. **`eval/evaluators.py` - OpenEvals 裁判长**
   基于最新的 `openevals` 库，引入了基于大语言模型（LLM-as-a-Judge）的三大核心打分维度：
   - **Groundedness (忠实度)**：答案是否严格依据了召回上下文，有无幻觉。
   - **Helpfulness (有用性)**：答案是否直击用户痛点，没有答非所问。
   - **Retrieval Relevance (检索相关性)**：向量库召回的内容与问题本身是否高度相关。
6. **`eval/run_eval.py` - 终极自动化评估入口**
   结合 LangSmith 的 `aevaluate` 接口，自动化遍历上述测试题库，并调用 `rag_agent.py` 得到回复，最后交由裁判打分，在 LangSmith 云端生成精美的量化可视化报表。

## 关键技术点

### 1. 强类型的状态流转
借助 Python 的 `typing.TypedDict`，构建了严谨的图状态：
```python
from typing import TypedDict

class GraphState(TypedDict):
    question: str
    context: str
    answer: str
```
完全对齐了原先 JS 中的 `Annotation.Root({...})`。

### 2. 避免目录名与官方库冲突
原先我们采用了 `langsmith` 作为功能模块目录，这极易导致与官方的 pip 包产生包名解析混淆（`ModuleNotFoundError`）。最佳实践是将其命名为诸如 `rag_demo` 这种业务向的名字，并确保项目内部使用绝对路径引用（例如 `from rag_demo.rag_agent import ask`）。

### 3. 环境隔离与跨层级的密钥加载
使用 `dotenv` 模块直接把 `.env` 中的 `LANGSMITH_API_KEY` 硬注入到了 `os.environ` 中，绕过了 `pydantic-settings` 只能作为属性读取的局限，确保了 LangSmith 官方底层 SDK 在独立运行评估脚本时不会报出 `Invalid token` 的鉴权错误。

## 评测执行流程
执行完整的评测仅需两条命令：
1. **更新测试集数据** (可选，有新的题库时运行):
   ```bash
   uv run rag_demo/eval/build_dataset.py
   ```
2. **触发全面评测打分**:
   ```bash
   uv run rag_demo/eval/run_eval.py
   ```
静待打分完成，点击终端输出的对比报告链接，即可在 LangSmith 控制台上直观比较模型微调、提示词修改前后的各个指标变化。
