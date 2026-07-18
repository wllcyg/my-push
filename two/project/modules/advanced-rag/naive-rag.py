import os
import sys

# 将项目根目录加入 sys.path，解决直接运行文件时找不到 modules 包的问题
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if root_dir not in sys.path:
    sys.path.append(root_dir)

from modules.core.llm import create_model
from typing import TypedDict, List
from langchain_core.documents import Document
from modules.core.vector_store import get_vector_store
from langgraph.graph import StateGraph, START, END
import asyncio


COLLECTION_NAME = 'ebook_collection'
TOP_K = 3

class State(TypedDict):
    question: str
    k: int
    documents: List[dict]  
    generation: str

model = create_model(temperature=0)

async def retrieve_relevant_content(question: str, k: int = TOP_K) -> List[dict]:
    try:
        vector_store = get_vector_store(COLLECTION_NAME)
        # 使用 LangChain 提供的异步搜索方法
        docs_with_scores = await vector_store.asimilarity_search_with_score(question, k=k)
        
        results = []
        for doc, score in docs_with_scores:
            results.append({
                "score": float(score),
                "content": doc.page_content,
                "id": doc.metadata.get("id", "unknown"),
                "book_id": doc.metadata.get("book_id", "未知"),
                "chapter_num": doc.metadata.get("chapter_num", "未知"),
                "index": doc.metadata.get("index", "未知"),
            })
        return results
    except Exception as e:
        print(f"检索内容时出错: {e}")
        return []

# 获取文章内容得node
async def retrieve_node(state: State) -> dict:
    # 从 state 字典中取值
    k = state.get("k", TOP_K)
    documents = await retrieve_relevant_content(state["question"], k)
    
    return {
        "question": state["question"],
        "k": k,
        "documents": documents
    }

# 生成回答的 node
async def generate_node(state: State) -> dict:
    documents = state.get("documents", [])
    
    # 拼接上下文
    context_parts = []
    for i, item in enumerate(documents):
        part = f"[片段 {i + 1}]\n章节: 第 {item.get('chapter_num', '未知')} 章\n内容: {item.get('content', '')}"
        context_parts.append(part)
        
    context = "\n\n━━━━━\n\n".join(context_parts)

    prompt = f"""你是一个专业的《长安的荔枝》小说助手。基于小说内容回答问题，用准确、详细的语言。

请根据以下《长安的荔枝》小说片段内容回答问题：
{context}

用户问题: {state.get("question", "")}

回答要求：
1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
2. 可以综合多个片段的内容，提供完整的答案
3. 如果片段中没有相关信息，请如实告知用户
4. 回答要准确，符合小说的情节和人物设定
5. 可以引用原文内容来支持你的回答

AI 助手的回答:"""

    print("\n【AI 回答（流式）】")
    generation = ""
    
    # 使用异步的流式输出 astream
    async for chunk in model.astream(prompt):
        text = chunk.content if isinstance(chunk.content, str) else ""
        if not text:
            continue
        generation += text
        # print 搭配 flush=True 完美复刻 process.stdout.write 的打字机效果
        print(text, end="", flush=True)
    
    print() # 打印最后的换行

    return {
        "question": state["question"],
        "k": state.get("k", TOP_K),
        "documents": documents,
        "generation": generation
    }


# 拼接图

workflow = StateGraph(State)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("generate", generate_node)
workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

app = workflow.compile()

async def main():
    question = "李善德最后去哪了？"
    k_arg = 5

    # 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
    print("【Graph Mermaid 图】")
    mermaid = app.get_graph().draw_mermaid()
    print(mermaid)
    print()
    
    # 提前触发一次连接加载（可选，利用 lru_cache 保证后续节点直接复用）
    get_vector_store(COLLECTION_NAME)

    print("=" * 80)
    print(f"问题: {question}")
    print("=" * 80)

    result = await app.ainvoke({
        "question": question,
        "k": k_arg,
        "documents": [],
        "generation": "",
    })

    print("\n【检索相关内容】")
    if not result.get("documents"):
        print("未找到相关内容")
        print("\n【AI 回答】")
        print("抱歉，我没有找到相关的《长安的荔枝》内容。")
        return
    else:
        for i, item in enumerate(result["documents"]):
            print(f"\n[片段 {i + 1}] 相似度: {item['score']:.4f}")
            print(f"书籍: {item.get('book_id', '未知')}")
            print(f"章节: 第 {item.get('chapter_num', '未知')} 章")
            print(f"片段索引: {item.get('index', '未知')}")
            # Python 中截断字符串
            content = item['content']
            truncated = content[:200] + ("..." if len(content) > 200 else "")
            print(f"内容: {truncated}")

    if not result.get("generation"):
        print("\n【AI 回答】")
        print("模型未返回内容。")

if __name__ == "__main__":
    asyncio.run(main())