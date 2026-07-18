import sys
import os

# 允许直接运行此文件
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from modules.core.llm import default_model

# 这里就是 Python 中对应 JS createAgent 的方法！
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

ROWS = [
    {"sku": "SKU-001", "name": "无线鼠标", "stock": 42},
]

class GetProductInput(BaseModel):
    product_id: str = Field(description="商品的 SKU 编号")

@tool('get_product_stock', args_schema=GetProductInput)
async def get_product_stock(product_id: str) -> str:
    """按 SKU 查商品名与库存，SKU 如 SKU-001。"""
    key = str(product_id).strip().upper()
    row = next((r for r in ROWS if r["sku"].upper() == key), None)
    if not row:
        return json.dumps({"found": False, "sku": key}, ensure_ascii=False)
    return json.dumps({"found": True, **row}, ensure_ascii=False)


# ==========================================
# 完美对齐 TS 版本的各种高级参数
# ==========================================
memory = MemorySaver()

graph = create_react_agent(
    default_model,
    tools=[get_product_stock],
    prompt="你是仓库助手。问库存时必须调用 get_product_stock（模拟数据），禁止编造。",
    checkpointer=memory
)

if __name__ == "__main__":
    import asyncio
    
    async def main():
        print("=== 流程图 Mermaid 源码 ===")
        print(graph.get_graph().draw_mermaid())
        print("===========================\n")
        
        # 因为加了 checkpointer，所以必须要传 config
        config = {"configurable": {"thread_id": "test_agent_001"}}
        inputs = {"messages": [("user", "帮我查一下 SKU-001 的库存情况")]}
        
        async for event in graph.astream(inputs, config=config, stream_mode="values"):
            message = event["messages"][-1]
            message.pretty_print()

    asyncio.run(main())