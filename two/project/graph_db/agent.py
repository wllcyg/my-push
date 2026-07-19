import sys
import os
# 将项目根目录加入到 Python 模块搜索路径中，防止找不到 modules 包
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage



from modules.core.llm import default_model
from graph_db.neo4j_manager import graph

class GraphState(TypedDict):
    """
    代理的状态定义，对应截图里的 state 对象
    """
    messages: Annotated[list, add_messages]
    query: str
    cypher: str
    context: str
    answer: str

# 第一步解析问题node
async def parse_question(state: GraphState) -> dict:
    """
    解析最近的一条消息作为后续处理的 query
    """
    last_message = state["messages"][-1]
    
    # LangGraph 中节点只需要返回需要更新的字段，它会自动合并到状态里
    return {"query": last_message.content}

# 步骤2: 生成 Cypher 语句
async def generate_cypher(state: GraphState) -> dict:
    prompt = f"""
你是一个专业的 Neo4j Cypher 生成器。
严格按照下面的结构生成正确语句，只返回纯 Cypher 代码，不要任何解释、不要标点、不要 markdown。

节点:
- Product: 奶茶产品
- Ingredient: 配料
- Type: 奶茶类型
- Method: 制作工艺
- People: 适合人群

关系方向（必须严格遵守）:
- (Product)-[:属于]->(Type)
- (Product)-[:包含]->(Ingredient)
- (Product)-[:适合]->(People)
- (Ingredient)-[:使用]->(Method)

规则:
1. 关系方向绝对不能反
2. 多跳查询请使用多个 MATCH，不要连错路径
3. 只返回最终可运行的 Cypher 语句

用户问题: {state['query']}
"""
    res = await default_model.ainvoke([HumanMessage(content=prompt)])
    return {"cypher": res.content}

# 步骤3: 执行图谱查询
async def execute_graph_query(state: GraphState) -> dict:
    try:
        # 捕获异常，防止大模型生成的 cypher 语法错误导致整个 agent 崩溃
        res = graph.query(state["cypher"])
        return {"context": json.dumps(res, ensure_ascii=False)}
    except Exception as e:
        return {"context": '未查询到相关知识'}

# 步骤4: 生成答案
async def generate_answer(state: GraphState) -> dict:
    prompt = f"""
你是奶茶专家，根据下方「检索结果」回答用户问题；检索结果为空或不足时简要说明无法从图谱得到答案，不要编造。
回答要求:
- 直接列出事实，不要推断图谱里未出现的配料（如水、冰、添加剂等）。

检索结果: {state['context']}
用户问题: {state['query']}
"""
    res = await default_model.ainvoke([HumanMessage(content=prompt)])
    return {"answer": res.content}

# ================= 连线图谱 (Edges) =================
# 1. 初始化 StateGraph
workflow = StateGraph(GraphState)

# 2. 注册所有的节点 (Nodes)
workflow.add_node("parse_question", parse_question)
workflow.add_node("generate_cypher", generate_cypher)
workflow.add_node("execute_graph_query", execute_graph_query)
workflow.add_node("generate_answer", generate_answer)

# 3. 定义图谱的流转流程 (Edges)
workflow.add_edge(START, "parse_question")
workflow.add_edge("parse_question", "generate_cypher")
workflow.add_edge("generate_cypher", "execute_graph_query")
workflow.add_edge("execute_graph_query", "generate_answer")
workflow.add_edge("generate_answer", END)

# 4. 编译成可执行的 app
app = workflow.compile()

# ================= 本地测试入口 =================
if __name__ == "__main__":
    import asyncio

    async def main():
        print("🍹 奶茶专家 GraphRAG Agent 启动！(输入 'quit' 退出)")
        while True:
            user_input = input("\n🧐 用户: ")
            if user_input.lower() in ["quit", "exit", "q"]:
                break
                
            # 初始化输入状态
            initial_state = {
                "messages": [HumanMessage(content=user_input)],
                "query": "",
                "cypher": "",
                "context": "",
                "answer": ""
            }
            
            print("⏳ 正在思考并检索图谱知识...")
            # 运行图谱（流转所有 Node）
            final_state = await app.ainvoke(initial_state)
            
            # 打印过程中生成的 Cypher 方便调试
            print(f"🔧 [调试信息] 提取的 Query: {final_state.get('query')}")
            print(f"🔧 [调试信息] 生成的 Cypher: \n{final_state.get('cypher')}")
            
            # 输出最终回答
            print(f"🤖 奶茶专家: {final_state.get('answer')}")

    # 执行异步主函数
    asyncio.run(main())

