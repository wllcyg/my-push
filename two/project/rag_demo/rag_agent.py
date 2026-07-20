from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts.chat import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# 依赖注入我们项目封装好的组件
from modules.core.vector_store import get_vector_store
from modules.core.llm import default_model

# ==========================================
# 1. 基础组件初始化 (对应 TS 的顶层依赖注入)
# ==========================================

vector_store = get_vector_store(
    collection_name="rag_docs",
    primary_field="langchain_primaryid",
    vector_field="langchain_vector",
    text_field="langchain_text",
    metric_type="L2"
)
retriever = vector_store.as_retriever(search_kwargs={"k": 4})

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "你是客服助手。仅根据下面「上下文」回答；上下文没有的信息请明确说不知道，不要编造。\n\n上下文：\n{context}"
    ), 
    (
        "human",
        "{question}"
    )
])

chain = prompt | default_model | StrOutputParser()

# ==========================================
# 2. 图状态定义 (对应 TS 的 Annotation.Root)
# ==========================================

class GraphState(TypedDict, total=False):
    question: str
    context: list  # 这里存储检索出来的 Document 列表
    answer: str

# ==========================================
# 3. 节点逻辑 (对应 TS 的 retrieve 和 generate)
# ==========================================

async def retrieve(state: GraphState):
    docs = await retriever.ainvoke(state["question"])
    return {"context": docs}

async def generate(state: GraphState):
    # 提取所有 Document 的 page_content 并用换行符拼接
    context_text = "\n\n".join(doc.page_content for doc in state["context"])
    
    answer = await chain.ainvoke({
        "context": context_text,
        "question": state["question"]
    })
    
    return {"answer": answer}

# ==========================================
# 4. 构建并编译图 (对应 TS 的 new StateGraph)
# ==========================================

workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

rag_app = workflow.compile()

# ==========================================
# 5. 导出统一入口 (对应 TS 的 export async function ask)
# ==========================================

async def ask(question: str):
    result = await rag_app.ainvoke({"question": question})
    return {
        "answer": result.get("answer"),
        "context": result.get("context", [])
    }