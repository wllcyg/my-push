import sys
import os

# 获取当前文件所在目录的上两级目录（即项目根目录 two/project），并加入系统路径
# 这样直接运行单文件时，Python 才能找到 `modules` 这个包
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from modules.core.llm import default_model
from langgraph.prebuilt import ToolNode
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import tools_condition

# 假数据，模拟「按 SKU 查库存」接口
ROWS = [
    {"sku": "SKU-001", "name": "无线鼠标", "stock": 42},
    {"sku": "SKU-002", "name": "机械键盘", "stock": 7},
    {"sku": "SKU-003", "name": "USB-C 线缆", "stock": 120},
]

class GetProductInput(BaseModel):
    product_id: str = Field(description="商品的 SKU 编号，例如 SKU-001")

@tool('get_product_stock', args_schema=GetProductInput)
async def get_product_stock(product_id: str) -> str:
    """按 SKU 查商品名与库存，SKU 如 SKU-001。"""
    key = str(product_id).strip().upper()
    
    # 模拟 JS 的 array.find
    row = next((r for r in ROWS if r["sku"].upper() == key), None)
    
    if not row:
        return json.dumps({"found": False, "sku": str(product_id).strip()}, ensure_ascii=False)
    
    return json.dumps({"found": True, **row}, ensure_ascii=False)

llm = default_model.bind_tools([get_product_stock])


# 定义模型，注意这里的 state 类型标注为 MessagesState，对齐 JS 的 MessagesAnnotation
async def agent_node(state: MessagesState):
    response = await llm.ainvoke(state.get("messages",[]))
    return {"messages": response}

tools_node = ToolNode([get_product_stock])

workflow = StateGraph(MessagesState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", tools_node)
workflow.add_edge(START, "agent")

# 这也是工具调用最核心的一步：tools_condition 会自动判断 LLM 是否返回了 tool_calls
workflow.add_conditional_edges("agent", tools_condition)

workflow.add_edge("tools", "agent")

# 对应 JS 的 .compile()
graph = workflow.compile()

if __name__ == "__main__":
    import asyncio
    
    async def main():
        # 打印生成的 Mermaid 图结构
        print("=== 流程图 Mermaid 源码 ===")
        print(graph.get_graph().draw_mermaid())
        print("===========================\n")
        
        # 简单测试大模型调用工具
        inputs = {"messages": [("user", "帮我查一下 SKU-001 的库存情况")]}
        async for event in graph.astream(inputs, stream_mode="values"):
            message = event["messages"][-1]
            message.pretty_print()

    asyncio.run(main())
