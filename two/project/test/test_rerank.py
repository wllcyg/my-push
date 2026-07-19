import os
import sys
import asyncio
from langchain_core.documents import Document

# 确保能正确引入项目的 modules 包
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.append(root_dir)

from modules.core.rerank import DashScopeRerank

async def main():
    print("====== 开始测试 DashScope (Qwen3) Rerank ======\n")

    # 1. 准备一堆模拟的初筛文档（假设是从 Elasticsearch 或 Zilliz 查出来的基础结果）
    docs = [
        Document(page_content="苹果是一种水果，富含维生素C。", metadata={"id": 1, "source": "维基百科"}),
        Document(page_content="苹果公司发布了最新的 iPhone 16 Pro，搭载 A18 芯片。", metadata={"id": 2, "source": "科技新闻"}),
        Document(page_content="香蕉也是一种很好的水果，特别适合运动后补充能量。", metadata={"id": 3, "source": "健康指南"}),
        Document(page_content="MacBook Pro 是苹果公司为专业人士打造的笔记本电脑。", metadata={"id": 4, "source": "数码评测"}),
        Document(page_content="昨天去超市买了两斤红富士苹果，挺甜的。", metadata={"id": 5, "source": "个人日记"})
    ]

    # 用户真实的查询意图：偏向于科技数码
    query = "苹果公司最近有什么新产品发布？"
    print(f"用户查询 (Query): {query}\n")

    # 2. 实例化我们封装好的重排器
    # 这里会自动从 .env 读取 QWEN3_VL_RERANK
    # top_n=2 表示我们只要最相关的 2 篇文章
    try:
        reranker = DashScopeRerank(model="qwen3-vl-rerank", top_n=2)
    except Exception as e:
        print(f"初始化失败: {e}")
        print("请检查你的 .env 文件中是否配置了 QWEN3_VL_RERANK")
        return

    # 3. 异步执行重排
    print("⏳ 正在请求阿里云大模型进行语义重排...")
    try:
        reranked_docs = await reranker.acompress_documents(documents=docs, query=query)
        
        print("\n✅ 重排完成！结果如下：")
        print("-" * 50)
        for i, doc in enumerate(reranked_docs, 1):
            score = doc.metadata.get("relevance_score", 0)
            print(f"Top {i} (打分: {score:.4f}) [来源: {doc.metadata.get('source')}]")
            print(f"内容: {doc.page_content}")
            print("-" * 50)

    except Exception as e:
        print(f"\n❌ 重排请求失败: {e}")

if __name__ == "__main__":
    asyncio.run(main())
