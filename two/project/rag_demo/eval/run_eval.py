import sys
import os
from pathlib import Path
import urllib.parse
import asyncio

project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env", override=True)

from langsmith import Client
from langsmith.evaluation import aevaluate

from rag_demo.rag_agent import ask
from rag_demo.eval.evaluators import rag_evaluators
from modules.config.settings import get_settings

settings = get_settings()

DATASET_NAME = "rag-eval-v1"
client = Client(api_key=os.environ.get("LANGSMITH_API_KEY") or os.environ.get("LANGCHAIN_API_KEY"))

# 被评测的 RAG Agent
async def run_rag_agent(inputs: dict) -> dict:
    result = await ask(inputs["question"])
    return {
        "answer": result["answer"],
        # 将 Document 列表映射为字符串列表，匹配 JS 逻辑
        "context": [doc.page_content for doc in result.get("context", [])]
    }

async def main():
    model_name = settings.open_ai_model_name or "qwen"
    experiment_prefix = f"rag-openevals-{model_name}"
    
    # Python 版本的 aevaluate 用于支持 async 的 target 函数
    result = await aevaluate(
        run_rag_agent,
        data=DATASET_NAME,
        evaluators=rag_evaluators,
        client=client,
        experiment_prefix=experiment_prefix,
        max_concurrency=2,
    )

    project = os.environ.get("LANGSMITH_PROJECT", "default")
    encoded_project = urllib.parse.quote(project)
    
    print("\n✅ 评测完成")
    print("实验名:", getattr(result, "experiment_name", "未知"))
    print("指标: rag_groundedness | rag_helpfulness | rag_retrieval_relevance")
    print(f"报告: https://smith.langchain.com/o/default/projects/p/{encoded_project}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
