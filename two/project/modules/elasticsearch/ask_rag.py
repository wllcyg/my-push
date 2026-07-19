from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END
from modules.core.llm import default_model
from modules.elasticsearch.query_augment import augment_query, retrieval_query_strings
import math
import asyncio
from modules.elasticsearch.es_service import es_service
from modules.core.vector_store import get_vector_store
from modules.config.settings import get_settings
from modules.core.rerank import DashScopeRerank
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

class HybridRetrievalState(TypedDict, total=False):
    query: str
    queryAugmentation: Optional[Dict[str, Any]]
    esHits: List[Dict[str, Any]]
    milvusHits: List[Dict[str, Any]]
    merged: List[Dict[str, Any]]
    topDocuments: List[Dict[str, Any]]
    answer: str

INDEX = "life_notes"

async def query_agent(state: HybridRetrievalState) -> HybridRetrievalState:
    """
    第一站：查询扩写节点
    将用户原始 query 发送给大模型，生成多个角度的变体，存入 queryAugmentation。
    """
    original_query = state.get("query", "")
    
    # 调用大模型执行扩写
    augmentation = await augment_query(default_model, original_query)
    
    # 打印测试（展示生成的用于召回的语句）
    search_queries = retrieval_query_strings(original_query, augmentation)
    print(f"\n[Query Agent] 原始问题: {original_query}")
    print(f"[Query Agent] 多路召回触发词: {search_queries}")
    
    # 将扩写结果塞回状态盒子里，传给下一个节点
    return {"queryAugmentation": augmentation}

async def es_recall_agent(state: HybridRetrievalState) -> HybridRetrievalState:
    """
    第二站：ES 全文检索召回
    利用原问题和扩写出的变体，并发执行多路 ES 查询，然后将结果拍平并去重。
    """
    original_query = state.get("query", "")
    augmentation = state.get("queryAugmentation", {})
    qs = retrieval_query_strings(original_query, augmentation)
    
    n = max(1, len(qs))
    ES_K = 10 # 设定总共想从 ES 捞多少条数据
    k_each = max(2, math.ceil(ES_K / n))
    
    async def fetch_es(q: str):
        query_body = {
            "multi_match": {
                "query": q,
                # 根据我们之前的 seed_data，字段名是 note_title 和 note_body
                "fields": ["note_title^2", "note_body"],
                "type": "best_fields",
                "analyzer": "ik_smart",
            }
        }
        res = await es_service.search(index_name=INDEX, query=query_body, size=k_each)
        return res.get("items", [])

    # Promise.all() 的 Python 终极平替：asyncio.gather 并发执行
    batches = await asyncio.gather(*(fetch_es(q) for q in qs))
    
    # 类似 flatMap：把嵌套列表拍平
    flat = [doc for batch in batches for doc in batch]
    
    # dedupeDocsById 去重逻辑
    seen = set()
    deduped = []
    for doc in flat:
        doc_id = doc.get("_id")
        if doc_id not in seen:
            seen.add(doc_id)

            deduped.append(doc)
            
    print(f"\n[ES Recall Agent] 经过多路召回与去重，最终从 ES 搜到 {len(deduped)} 篇相关日记")
    
    return {"esHits": deduped}

async def milvus_recall_agent(state: HybridRetrievalState) -> HybridRetrievalState:
    """
    第三站：Milvus 向量检索召回
    利用原问题和扩写出的变体并发执行向量搜索，然后结果拍平去重。
    """
    original_query = state.get("query", "")
    augmentation = state.get("queryAugmentation", {})
    qs = retrieval_query_strings(original_query, augmentation)
    
    n = max(1, len(qs))
    MILVUS_K = 10 # 设定总共想从 Milvus 捞多少条数据
    k_each = max(2, math.ceil(MILVUS_K / n))
    
    vector_store = get_vector_store(
        INDEX,
        text_field="doc_text",
        primary_field="langchain_primaryid",
        vector_field="embedding",
        metric_type="L2"
    )
    
    async def fetch_milvus(q: str):
        # asimilarity_search 返回的是 Langchain 的 Document 对象
        docs = await vector_store.asimilarity_search(q, k=k_each)
        
        results = []
        for doc in docs:
            # 统一数据结构，把 Milvus 的 metadata 扁平化，并用 id 顶替 _id (为了和 ES 保持一致)
            meta = doc.metadata
            item = {
                "_id": meta.get("id"),
                "note_title": meta.get("note_title"),
                "note_body": meta.get("note_body"),
                "tags": meta.get("tags", "").split(",") if meta.get("tags") else [],
                "mood": meta.get("mood"),
                "priority": meta.get("priority"),
                "doc_text": doc.page_content,
            }
            results.append(item)
        return results

    # 并发查询
    batches = await asyncio.gather(*(fetch_milvus(q) for q in qs))
    
    # 拍平
    flat = [doc for batch in batches for doc in batch]
    
    # 去重
    seen = set()
    deduped = []
    for doc in flat:
        doc_id = doc.get("_id")
        if doc_id and doc_id not in seen:
            seen.add(doc_id)
            deduped.append(doc)
            
    print(f"\n[Milvus Recall Agent] 经过多路召回与去重，最终从 Milvus 搜到 {len(deduped)} 篇相关日记")
    
    return {"milvusHits": deduped}

async def merge_agent(state: HybridRetrievalState) -> HybridRetrievalState:
    """
    第四站：双路合并与去重
    将 esHits 和 milvusHits 合并，补充统一的 doc_text 字段，并按 _id 去重。
    （因为 es_docs 拼接在前面，所以如果同时搜到，优先保留 ES 的排序/结果）
    """
    es_docs = state.get("esHits", [])
    milvus_docs = state.get("milvusHits", [])
    
    combined = es_docs + milvus_docs
    
    seen = set()
    out = []
    
    for d in combined:
        # 为缺乏整体正文的文档（例如 ES）拼凑 doc_text
        if "doc_text" not in d:
            title = str(d.get("note_title") or "")
            body = str(d.get("note_body") or "")
            d["doc_text"] = f"{title}\n{body}".strip()
            
        if not d.get("doc_text"):
            continue
            
        doc_id = str(d.get("_id") or "").strip()
        if not doc_id:
            continue
            
        if doc_id not in seen:
            seen.add(doc_id)
            out.append(d)
            
    print(f"\n[Merge Agent] 合并双路召回结果完毕，最终保留了 {len(out)} 篇有效日记")
    
    return {"merged": out}

# ================= 初始化重排器 =================
reranker = DashScopeRerank(top_n=3, model="qwen-rerank")

async def rerank_agent(state: HybridRetrievalState) -> HybridRetrievalState:
    """
    第五站：重排 (Rerank)
    将合并后的文档列表交给已经封装好的重排器，提取最相关的 Top N。
    """
    query = state.get("query", "")
    merged = state.get("merged", [])
    
    if not merged:
        return {"topDocuments": []}
        
    # 适配封装组件：将 Dict 转换为 LangChain Document
    docs_to_rerank = [
        Document(
            page_content=d.get("doc_text", ""),
            metadata={k: v for k, v in d.items() if k != "doc_text"}
        )
        for d in merged
    ]
    
    # 异常捕获防止 API 报错中断流程
    try:
        compressed_docs = await reranker.acompress_documents(docs_to_rerank, query)
    except Exception as e:
        print(f"[Rerank] 重排器调用失败: {e}，回退至取前三")
        return {"topDocuments": merged[:3]}
        
    # 再转回 Dict，保持 State 的一致性
    top_docs = []
    for doc in compressed_docs:
        item = dict(doc.metadata)
        item["doc_text"] = doc.page_content
        top_docs.append(item)
        
    print(f"\n[Rerank Agent] 重排完毕，从 {len(merged)} 篇中优选出 Top {len(top_docs)} 篇")
    return {"topDocuments": top_docs}

ANSWER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", 
     "你是阅读用户「生活笔记」知识库并作答的助手。\n"
     "规则：\n"
     "- 只根据下方「检索片段」推断答案；片段里没有的信息不要编造。\n"
     "- 若片段不足以回答，明确说明「笔记里未提到」，并可给出一句保守建议。\n"
     "- 回答简洁有条理，可使用简短列表；口吻自然中文。"),
    ("human", "用户问题：{query}\n\n检索片段：\n{context}")
])

NO_CONTEXT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", 
     "你是阅读用户「生活笔记」知识库并作答的助手。当前没有检索到任何片段。\n"
     "请用一两句话说明无法从笔记中回答，并礼貌询问用户是否换个说法或补充关键词。"),
    ("human", "用户问题：{query}")
])

def stringify_message_content(content: Any) -> str:
    """
    等价于 JS 的 stringifyMessageContent。
    防止 LangChain 某些大模型（如 Anthropic/复杂响应）返回 List[Dict] 结构而不是纯字符串。
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
    return str(content)

async def generate_answer_agent(state: HybridRetrievalState) -> HybridRetrievalState:
    """
    第六站：生成最终回答
    """
    query = state.get("query", "")
    docs = state.get("topDocuments", [])
    
    if not docs:
        chain = NO_CONTEXT_PROMPT | default_model
        msg = await chain.ainvoke({"query": query})
        return {"answer": stringify_message_content(msg.content).strip()}
        
    context = "\n\n---\n\n".join([f"[{i+1}] id={d.get('_id')}\n{d.get('doc_text')}" for i, d in enumerate(docs)])
    
    chain = ANSWER_PROMPT | default_model
    msg = await chain.ainvoke({"query": query, "context": context})
    
    return {"answer": stringify_message_content(msg.content).strip()}

# ================= 流程图构建 =================
workflow = StateGraph(HybridRetrievalState)

# 1. 注册节点
workflow.add_node("query_agent", query_agent)
workflow.add_node("es_recall_agent", es_recall_agent)
workflow.add_node("milvus_recall_agent", milvus_recall_agent)
workflow.add_node("merge_agent", merge_agent)
workflow.add_node("rerank_agent", rerank_agent)
workflow.add_node("generate_answer_agent", generate_answer_agent)

# 2. 编排边（连线）
# 扩写完成后，同时交给 ES 和 Milvus 执行 (并行化)
workflow.add_edge(START, "query_agent")
workflow.add_edge("query_agent", "es_recall_agent")
workflow.add_edge("query_agent", "milvus_recall_agent")

# 两路召回全部执行完毕后，流入 merge_agent 进行去重
workflow.add_edge("es_recall_agent", "merge_agent")
workflow.add_edge("milvus_recall_agent", "merge_agent")

workflow.add_edge("merge_agent", "rerank_agent")
workflow.add_edge("rerank_agent", "generate_answer_agent")
workflow.add_edge("generate_answer_agent", END)

# 3. 编译成可执行的图
graph = workflow.compile()
# ============================================

async def run_main():
    # 测试前必须先连接 ES (因为这是单文件测试，没走 FastAPI 启动流程)
    from modules.config.settings import get_settings
    settings = get_settings()
    await es_service.connect(settings.es_host)

    state = HybridRetrievalState()
    state["query"] = "我想找下今年五一的旅行攻略"    
    
    # 跑图
    result = await graph.ainvoke(state)
    
    # 清理连接
    await es_service.close()
    
    return result    

if __name__ == "__main__":
    print("====== 开始运行 LangGraph 测试 ======")
    final_state = asyncio.run(run_main())
    print("\n====== 执行完毕，最终 State (截断显示部分字段) ======")
    # 避免 ES 文档把终端刷满，只打印提取的标题
    if "esHits" in final_state:
        titles = [doc.get("note_title") for doc in final_state["esHits"]]
        print("ES 召回的标题有:", titles)
        
    if "milvusHits" in final_state:
        titles = [doc.get("note_title") for doc in final_state["milvusHits"]]
        print("Milvus 召回的标题有:", titles)
        
    if "merged" in final_state:
        titles = [doc.get("note_title") for doc in final_state["merged"]]
        print("合并去重的标题有:", titles)
        
    if "topDocuments" in final_state:
        titles = [doc.get("note_title") for doc in final_state["topDocuments"]]
        print("\n🏆 Rerank 重排后的核心参考资料:", titles)
        
    if "answer" in final_state:
        print("\n🤖 最终生成的回答:\n")
        print(final_state["answer"])
        print("\n============================================\n")
