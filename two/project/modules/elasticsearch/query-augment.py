from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List

class QueryAugmentationSchema(BaseModel):
    queries: List[str] = Field(
        min_length=3,
        max_length=3,
        description="恰好 3 条中文检索问句：不同角度改写或扩写；保留订单号、品牌等字面信息；不要编造事实"
    )

augment_prompt = ChatPromptTemplate.from_messages([
    ("system", """用户会给出一句中文问题。请另外写出恰好 3 条检索用的问句（与原意一致、角度尽量不同），便于搜索引擎或向量库分别召回：可改写说法、换提问角度、或略加限定词；专有名词、型号、订单号等必须保留原样。
    只输出结构化字段 queries（长度为 3 的字符串数组）。"""),
    ("user", "{query}")
])

def normalize_three_queries(original: str, query_list: List[str] | None) -> List[str]:
    """
    兜底规范化函数：确保无论大模型返回什么，最终都严格返回 3 条有效的查询语句。
    """
    out = []
    
    # 1. 过滤与清理：去掉非字符串和空字符串
    if query_list:
        for s in query_list:
            if isinstance(s, str):
                s_stripped = s.strip()
                if s_stripped:
                    out.append(s_stripped)
                    
    # 2. 数量兜底：如果大模型罢工、出错，或者返回的不够 3 条，就拿用户的原问题来凑数凑齐 3 条
    while len(out) < 3:
        out.append(original)
        
    # 3. 截断控制：如果大模型话太多返回了 4 条以上，强行只取前 3 条
    return out[:3]

async def augment_query(chat_model, query: str) -> dict:
    """
    调用大模型进行查询扩写
    """
    structured_llm = chat_model.with_structured_output(QueryAugmentationSchema)
    chain = augment_prompt | structured_llm
    
    try:
        raw_result = await chain.ainvoke({"query": query})
        # raw_result 是 QueryAugmentationSchema 对象，直接访问 .queries 属性
        queries = raw_result.queries if raw_result else []
        return {"queries": normalize_three_queries(query, queries)}
    except Exception as e:
        print(f"Query augmentation failed: {e}")
        # 如果模型调用超时或报错，安静地用原问题兜底
        return {"queries": normalize_three_queries(query, [])}

def retrieval_query_strings(original: str, augmentation: dict | None) -> List[str]:
    """
    原始问题在前，其后接 LLM 生成的问句；不做去重，顺序固定；每条各跑一次 ES、Milvus
    """
    augmented_queries = augmentation.get("queries", []) if augmentation else []
    combined = [original] + augmented_queries
    
    out = []
    for s in combined:
        if isinstance(s, str):
            s_stripped = s.strip()
            if s_stripped:
                out.append(s_stripped)
                
    return out
