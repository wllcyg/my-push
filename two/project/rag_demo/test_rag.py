import sys
import os
from pathlib import Path
import asyncio

# 将项目根目录添加到 sys.path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from rag_demo.rag_agent import ask
import re

DEFAULT_QUESTIONS = [
    "无理由退货要在几天内？",
    "满多少元包邮？",
    "金卡会员有什么折扣？",
    "电子发票多久能开好？",
    "手机保修多久？",
    "紧急问题怎么联系客服？",
]

def print_context(context):
    if not context:
        print("\n引用片段: （无）")
        return
    
    print("\n引用片段:")
    for i, doc in enumerate(context):
        source = doc.metadata.get("source", "未知") if hasattr(doc, "metadata") else "未知"
        # 类似 JS 的 replace(/\s+/g, " ")
        text = re.sub(r'\s+', ' ', doc.page_content).strip()
        preview = f"{text[:100]}…" if len(text) > 100 else text
        print(f"  [{i + 1}] {source}")
        print(f"      {preview}")

async def main():
    args = sys.argv[1:]
    questions = [" ".join(args)] if args else DEFAULT_QUESTIONS

    for i, question in enumerate(questions):
        print(f"\n{'=' * 50}")
        print(f"问题 {i + 1}: {question}")

        result = await ask(question)
        answer = result.get("answer")
        context = result.get("context", [])

        print(f"\n答: {answer}")
        print_context(context)

    print(f"\n{'=' * 50}")
    print(f"共 {len(questions)} 个问题")

if __name__ == "__main__":
    # 针对可能存在的 asyncio 事件循环嵌套问题，使用 asnycio.run 启动
    asyncio.run(main())
