import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env", override=True)

from openevals.llm import create_async_llm_as_judge
from openevals.prompts import (
    RAG_GROUNDEDNESS_PROMPT,
    RAG_HELPFULNESS_PROMPT,
    RAG_RETRIEVAL_RELEVANCE_PROMPT,
)
from modules.core.llm import default_model  # 直接复用项目中配置好的模型

# RAG_GROUNDEDNESS_PROMPT —— 忠实度：答案是否被检索上下文支撑，有无幻觉
rag_groundedness_judge = create_async_llm_as_judge(
    prompt=RAG_GROUNDEDNESS_PROMPT,
    feedback_key="rag_groundedness",
    judge=default_model,
    continuous=True,
)

# RAG_HELPFULNESS_PROMPT —— 回答有用性：是否切题、是否答非所问
rag_helpfulness_judge = create_async_llm_as_judge(
    prompt=RAG_HELPFULNESS_PROMPT,
    feedback_key="rag_helpfulness",
    judge=default_model,
    continuous=True,
)

# RAG_RETRIEVAL_RELEVANCE_PROMPT —— 检索相关性：召回片段与问题是否相关
rag_retrieval_relevance_judge = create_async_llm_as_judge(
    prompt=RAG_RETRIEVAL_RELEVANCE_PROMPT,
    feedback_key="rag_retrieval_relevance",
    judge=default_model,
    continuous=True,
)

# 在 Python 的 LangSmith 评估中，自定义评估器通常接收 `run` 和 `example` 参数
# run.outputs 会包含我们在 ask() 中返回的 {"answer": ..., "context": ...}
# run.inputs (或 example.inputs) 会包含 {"question": ...}

async def rag_groundedness_evaluator(run, example=None):
    outputs = run.outputs or {}
    return await rag_groundedness_judge(
        context={"documents": outputs.get("context", [])},
        outputs={"answer": outputs.get("answer", "")},
    )

async def rag_helpfulness_evaluator(run, example=None):
    inputs = run.inputs or {}
    outputs = run.outputs or {}
    return await rag_helpfulness_judge(
        inputs=inputs,
        outputs={"answer": outputs.get("answer", "")},
    )

async def rag_retrieval_relevance_evaluator(run, example=None):
    inputs = run.inputs or {}
    outputs = run.outputs or {}
    return await rag_retrieval_relevance_judge(
        inputs=inputs,
        context={"documents": outputs.get("context", [])},
    )

rag_evaluators = [
    rag_groundedness_evaluator,
    rag_helpfulness_evaluator,
    rag_retrieval_relevance_evaluator,
]
