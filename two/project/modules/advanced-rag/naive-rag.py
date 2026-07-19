import os
import sys

# 将项目根目录加入 sys.path，解决直接运行文件时找不到 modules 包的问题
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if root_dir not in sys.path:
    sys.path.append(root_dir)

from modules.core.llm import create_model
from typing import TypedDict, List, Literal
from langchain_core.documents import Document
from modules.core.vector_store import get_vector_store
from langgraph.graph import StateGraph, START, END
import asyncio
from pydantic import BaseModel, Field
from typing import Optional
from modules.ai.tools.web_search import web_search

COLLECTION_NAME = 'ebook_collection'
TOP_K = 3

# 路由定义
class RouterSchemas(BaseModel):
    strategy: Literal['simple', 'complex'] = Field(
        default='simple',
        description="simple: 普通问题, 需要简单回答. complex: 复杂问题, 需要详细回答."
    )
    reason: str = Field(
        ...,
        description="选择 'simple' 或 'complex' 的原因"
    )
# 拆分问题与后续操作定义
class DecomposeSchema(BaseModel):
    sub_questions: List[str] = Field(
        min_length=1, max_length=8,
        description="拆分出的子问题列表"
    )
    reason: str = Field(
        ...,
        description="拆分的原因说明"
    )

class NextStepsSchema(BaseModel):
    nextAction: Literal['retrieve', 'generate'] = Field(
        ...,
        description="下一步的操作，继续检索(retrieve)还是生成答案(generate)"
    )
    reason: str = Field(
        ...,
        description="选择该操作的原因"
    )

class EvaluateSchema(BaseModel):
    enough: bool = Field(description="是否足够回答")
    missing: List[str] = Field(default_factory=list, description="若不够，列出缺失信息点（最多 6 条）", max_length=6)
    reason: str = Field(description="简短原因")
    web_query: Optional[str] = Field(default=None, description="若不够，给出一个适合联网搜索的中文查询句")

# 定义的state
class State(TypedDict):
    question: str
    k: int
    documents: List[dict]  
    # 定义路由相关,普通问题 simple, 复杂的 complex
    strategy: Literal['simple', 'complex']
    routeReason: str
    # 将主问题进行拆分
    subQusetion: List[str]
    # 关于下一轮的retrieve
    nextSubIdx: int
    currentQuery:str
    retirevalCount: int
    plannedNext: str
    webContext: str
    evaluation: str
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

# 路由节点
async def route_question_node(state: State) -> dict:
    print("---ROUTE_QUESTION---")
    router = model.with_structured_output(RouterSchemas)
    
    prompt = f"""你是问答路由器。请判断用户问题是否需要外部检索。

规则:
- simple: 常识问答、简短定义、无需特定小说细节即可回答。
- complex: 需要《长安的荔枝》具体情节、人物关系、章节事实、原文细节或证据支持。

用户问题: {state.get('question')}
"""
    
    # 调用大模型执行路由判定
    route = await router.ainvoke(prompt)
    print(f"路由策略: {route.strategy} ({route.reason})")
    
    return {
        "question": state.get("question"),
        "k": state.get("k", TOP_K),
        "strategy": route.strategy,
        "routeReason": route.reason,
    }

# 拆分问题节点
async def decompose_node(state: State) -> dict:
    print("---DECOMPOSE---")
    decomposer = model.with_structured_output(DecomposeSchema)
    
    prompt = f"""任务：将问题拆成**有序**子问题列表 sub_questions，用于**依次向量检索**。要求：
1. 链式推理、多层关系、因果先后的问题，必须拆成多条；单跳即可答的也可只输出 1 条。
2. 每条子问题必须是**可独立检索**的完整中文问句，**禁止**使用「他/她/此人/上文」等指代；可写全人物名与事件名。
3. 顺序必须符合推理链：先搞清前置实体/事实，再查后续结论。
4. **不要**把整句原题原样复制成唯一一条（除非确实无法拆分）；不要拆成过碎的关键词列表。
5. 输出 1～8 条即可。

用户问题: {state.get('question')}

请输出 sub_questions 与简短 reason。"""
    
    out = await decomposer.ainvoke(prompt)
    # 过滤掉空字符串
    sub_questions = [s.strip() for s in out.sub_questions if s.strip()]
    
    if len(sub_questions) == 0:
        raise ValueError("decompose_question: sub_questions 为空")
        
    print(f"拆解 {len(sub_questions)} 条子问题 ({out.reason})")
    for i, q in enumerate(sub_questions):
        print(f"  [{i + 1}] {q}")
        
    return {
        "subQusetion": sub_questions,  # 这里的拼写与您上方 State 保持一致
        "nextSubIdx": 0,
        "currentQuery": sub_questions[0],
    }

# 获取文章内容得node
async def retrieve_node(state: State) -> dict:
    subs = state.get("subQusetion", [])
    idx = state.get("nextSubIdx", 0)
    
    if idx >= len(subs) or not subs[idx].strip():
        raise ValueError(f"retrieve: 子问题下标 {idx} 无有效文本（共 {len(subs)} 条）")
        
    q = subs[idx].strip()
    # 注意拼写跟 State 保持一致: retirevalCount
    round_num = state.get("retirevalCount", 0) + 1  
    
    print(f"---RETRIEVE (第 {round_num} 轮，子问题 {idx + 1}/{len(subs)})---")
    print(f"查询: {q}")
    
    k = state.get("k", TOP_K)
    new_docs = await retrieve_relevant_content(q, k)
    merged = merge_unique(state.get("documents", []), new_docs)
    
    if len(new_docs) == 0:
        print("本轮未命中文档")
    else:
        print(f"本轮命中 {len(new_docs)} 条，累计去重后 {len(merged)} 条")
        for i, item in enumerate(new_docs):
            preview = item['content'][:120] + "..." if len(item['content']) > 120 else item['content']
            print(f"[R{i + 1}] score={float(item['score']):.4f} chapter={item.get('chapter_num')} index={item.get('index')}")
            print(f"      {preview}")
            
    return {
        "documents": merged,
        "retirevalCount": round_num,
        "nextSubIdx": idx + 1,
        "currentQuery": q,
    }

# 判断下一步节点
async def plan_next_step_node(state: State) -> dict:
    print("---PLAN_NEXT_STEP---")
    subs = state.get("subQusetion", [])
    next_idx = state.get("nextSubIdx", 0)
    remaining = len(subs) - next_idx
    
    sub_list = []
    for i, s in enumerate(subs):
        status = " （已检索）" if i < next_idx else " （下一轮将检索，若选择继续）" if i == next_idx else " （未检索）"
        sub_list.append(f"{i + 1}. {s}{status}")
    sub_list_str = "\n".join(sub_list)
    
    docs = state.get("documents", [])
    if len(docs) == 0:
        doc_str = "（尚无检索结果）"
    else:
        doc_lines = []
        for i, d in enumerate(docs[:6]):
            content = d.get("content", "")
            preview = content[:200] + "..." if len(content) > 200 else content
            doc_lines.append(f"[{i + 1}] score={float(d.get('score', 0)):.4f} 第{d.get('chapter_num', '未知')}章: {preview}")
        doc_str = "\n\n".join(doc_lines)
        
    # 最大检索轮数
    max_retrievals = 3
    
    prompt = f"""你是多跳 RAG 规划器。检索查询已由前置步骤拆解为**有序子问题**；若需继续检索，下一轮将自动使用「下一条子问题」做向量检索，你**不要**自拟新的检索句。

用户原始问题：{state.get("question")}

子问题序列：
{sub_list_str if sub_list_str else "（无）"}

已检索轮数：{state.get("retirevalCount", 0)}；剩余未检索子问题条数：{remaining}
最大检索轮数上限：{max_retrievals}

已召回文档摘要：
{doc_str}

请判断下一步：
1) 已有足够依据回答用户原始问题 → nextAction=generate
2) 仍缺关键事实、且仍存在未检索的子问题、且未超过轮数上限 → nextAction=retrieve

硬性规则：
- 若剩余未检索子问题条数为 0，必须 nextAction=generate。
- 若已检索轮数已达到或超过最大检索轮数，必须 nextAction=generate。"""

    model_structured = model.with_structured_output(NextStepsSchema)
    out = await model_structured.ainvoke(prompt)
    
    next_action = out.nextAction
    reason = out.reason
    
    final_next = next_action
    if state.get("retirevalCount", 0) >= max_retrievals:
        final_next = "generate"
    if remaining <= 0:
        final_next = "generate"
        
    print(f"[决策] plannedNext={final_next} (模型建议={next_action}) ({reason})")
    
    return {
        "plannedNext": final_next
    }

# 直接回答节点
async def direct_answer_node(state: State) -> dict:
    print("---DIRECT_ANSWER---")
    print("\n【AI 回答（流式）】")
    
    prompt = f"""你是一个中文问答助手，请直接简洁回答问题。

问题：{state["question"]}
"""
    # 替换为非流式，防止部分兼容接口对 astream 支持不稳定导致卡死
    response = await model.ainvoke(prompt)
    generation = response.content if isinstance(response.content, str) else ""
    print(generation)

    return {
        "question": state["question"],
        "k": state.get("k", TOP_K),
        "strategy": state["strategy"],
        "routeReason": state["routeReason"],
        "documents": [],
        "generation": generation
    }

import json

async def evaluate_local_node(state: State) -> dict:
    has_web = bool(state.get("webContext", "").strip())
    print("---EVALUATE_CONTEXT_WITH_WEB---" if has_web else "---EVALUATE_LOCAL_CONTEXT---")
    
    documents = state.get("documents", [])
    local_parts = []
    for i, item in enumerate(documents):
        local_parts.append(f"[片段 {i + 1}]\n内容: {item.get('content', '')}")
    local_context = "\n\n".join(local_parts)
    
    prompt = f"""你是信息充分性评估器。判断当前多跳检索所累积的上下文是否足以回答用户问题。

用户问题：{state.get("question")}

已检索上下文（来自本地知识库）：
{local_context or "（空）"}

{f"联网搜索结果：{state.get('webContext')}" if has_web else ""}

输出要求：请严格按照 EvaluateSchema 格式输出。
如果信息不够，请给出缺失点，并提供一个适合联网搜索的查询句 (web_query)。"""
    model_structured = model.with_structured_output(EvaluateSchema)
    out = await model_structured.ainvoke(prompt)
    
    print(f"{'二次评估' if has_web else '评估'}: enough={out.enough} ({out.reason})")
    if not out.enough and out.missing:
        for i, m in enumerate(out.missing):
            print(f"  缺失{i + 1}: {m}")
            
    return {"evaluation": out.model_dump_json()}

async def web_search_node(state: State) -> dict:
    print("---WEB_SEARCH---")
    try:
        parsed = json.loads(state.get("evaluation", "{}"))
    except:
        parsed = {}
        
    query = (parsed.get("web_query") or "").strip() or state.get("question")
    print(f"联网查询: {query}")
    try:
        web_context = await web_search.ainvoke({"query": query, "count": 8})
        print(f"联网结果长度: {len(web_context)}")
    except Exception as e:
        print(f"联网搜索报错: {e}")
        web_context = ""
    return {"webContext": web_context}

# RAG 生成回答的 node
async def rag_generate_node(state: State) -> dict:
    print("---RAG_GENERATE---")
    documents = state.get("documents", [])
    
    # 拼接本地上下文
    local_parts = []
    for i, item in enumerate(documents):
        local_parts.append(f"[片段 {i + 1}]\n章节: 第 {item.get('chapter_num', '未知')} 章\n内容: {item.get('content', '')}")
    local_context = "\n\n━━━━━\n\n".join(local_parts)
    
    web_context = state.get("webContext", "")
    context = f"【本地知识库】\n{local_context or '（空）'}"
    if web_context.strip():
        context += f"\n\n【联网搜索补充】\n{web_context}"

    prompt = f"""你是一个严谨的中文问答助手。优先依据上下文作答，不要编造。

上下文（多跳检索累积的本地知识库 + 可选的联网补充）：
{context}

用户问题: {state.get("question", "")}

回答要求：
1. 如果上下文足够，给出清晰、可核对的回答；需要时引用片段编号或网址来支撑。
2. 如果上下文仍不足以确定关键事实，明确说明无法从上下文确认。
3. 回答要准确，符合逻辑。

AI 助手的回答:"""

    print("\n【AI 回答（流式）】")
    # 替换为非流式，防止部分兼容接口对 astream 支持不稳定导致卡死
    response = await model.ainvoke(prompt)
    generation = response.content if isinstance(response.content, str) else ""
    print(generation)

    return {
        "question": state["question"],
        "k": state.get("k", TOP_K),
        "strategy": state["strategy"],
        "routeReason": state["routeReason"],
        "documents": documents,
        "generation": generation
    }

# 按照id合并
def merge_unique(existing_docs: List[dict], new_docs: List[dict]) -> List[dict]:
    """按 id 合并文档；如果 id 相同，保留 score 更高的那一个"""
    doc_map = {}
    
    for d in existing_docs + new_docs:
        key = str(d.get("id"))
        prev = doc_map.get(key)
        
        if not prev or float(d.get("score", 0)) > float(prev.get("score", 0)):
            doc_map[key] = d
            
    merged = list(doc_map.values())
    merged.sort(key=lambda x: float(x.get("score", 0)), reverse=True)
    return merged

# 路由函数
def after_route(state: State) -> Literal['direct_answer', 'decompose_node']:
    return "direct_answer" if state.get("strategy") == "simple" else "decompose_node"

def after_plan(state: State) -> Literal['retrieve', 'evaluate_local']:
    return "retrieve" if state.get("plannedNext") == "retrieve" else "evaluate_local"

def after_evaluate(state: State) -> Literal['rag_generate', 'web_search']:
    if state.get("webContext", "").strip():
        return "rag_generate"
    try:
        parsed = json.loads(state.get("evaluation", "{}"))
    except:
        parsed = {}
    return "rag_generate" if parsed.get("enough") is True else "web_search"

# 拼接图

workflow = StateGraph(State)
workflow.add_node("route_question", route_question_node)
workflow.add_node("direct_answer", direct_answer_node)
workflow.add_node("decompose_node", decompose_node)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("plan_next_step", plan_next_step_node)
workflow.add_node("evaluate_local", evaluate_local_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("rag_generate", rag_generate_node)

workflow.add_edge(START, "route_question")

# 路由后分支：简单问题去回答，复杂问题去拆解
workflow.add_conditional_edges(
    "route_question",
    after_route,
    {
        "direct_answer": "direct_answer",
        "decompose_node": "decompose_node"
    }
)

workflow.add_edge("decompose_node", "retrieve")
workflow.add_edge("retrieve", "plan_next_step")

# 规划后分支：继续检索，还是去评估本地资料
workflow.add_conditional_edges(
    "plan_next_step",
    after_plan,
    {
        "retrieve": "retrieve",
        "evaluate_local": "evaluate_local"
    }
)

# 评估后分支：生成回答，还是去联网兜底
workflow.add_conditional_edges(
    "evaluate_local",
    after_evaluate,
    {
        "rag_generate": "rag_generate",
        "web_search": "web_search"
    }
)
workflow.add_edge("web_search", "evaluate_local")

workflow.add_edge("direct_answer", END)
workflow.add_edge("rag_generate", END)

app = workflow.compile()

async def main():
    # 这是一个超纲测试题：结合了非常具体的小说情节要求（逼迫模型走多跳）与衍生现实信息（逼迫模型联网）
    question = "请严格根据原著小说片段，列出李善德在运送荔枝过程中尝试了哪几种保鲜的容器？最后，另外帮我查一下现实中 2024 年我国荔枝产业的总体产值大约是多少？"
    k_arg = 5

    # 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
    print("【Graph Mermaid 图】")
    try:
        mermaid = app.get_graph().draw_mermaid()
        print(mermaid)
    except Exception:
        pass
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

    if result.get("strategy") == "complex":
        print("\n【检索相关内容】")
        if not result.get("documents"):
            print("未找到相关内容")
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

    print(f"\n最终策略: {result.get('strategy')}")
    if not result.get("generation", "").strip():
        print("模型未返回内容。")

if __name__ == "__main__":
    asyncio.run(main())