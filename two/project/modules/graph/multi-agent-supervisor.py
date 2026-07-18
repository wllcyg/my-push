# 多agent使用
import sys
import os

# 允许在 IDE 中直接点击运行本文件
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
from modules.core.llm import default_model
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# 假接口：演示 supervisor 如何把问题分给不同子代理

def norm_city(city: str) -> str:
    return str(city).strip()

WEATHER_TABLE = {
    "杭州": {"summary": "多云转小雨", "tempHighC": 22, "tempLowC": 15, "aqi": "良"},
    "北京": {"summary": "晴", "tempHighC": 26, "tempLowC": 12, "aqi": "轻度污染"},
    "上海": {"summary": "阴", "tempHighC": 20, "tempLowC": 16, "aqi": "良"},
}

TRIVIA_TABLE = {
    "杭州": "西湖文化景观是世界文化遗产之一。",
    "北京": "故宫是世界上现存规模最大的古代宫殿建筑群之一。",
    "上海": "外滩万国建筑博览群是近代城市历史的缩影。",
}

class CityInput(BaseModel):
    city: str = Field(description="需要查询的城市名称，例如：杭州、北京")

@tool('lookup_weather', args_schema=CityInput)
async def lookup_weather(city: str) -> str:
    """查某地当日天气摘要（模拟）。如果用户问天气，必须调用此工具。"""
    c = norm_city(city)
    w = WEATHER_TABLE.get(c)
    if not w:
        return json.dumps({
            "city": c,
            "summary": "暂无该城市数据，以下为占位",
            "tempHighC": 20,
            "tempLowC": 12,
            "aqi": "—",
        }, ensure_ascii=False)
    
    return json.dumps({"city": c, **w}, ensure_ascii=False)

@tool('lookup_city_trivia', args_schema=CityInput)
async def lookup_city_trivia(city: str) -> str:
    """查与某城市相关的一句小知识（模拟）。如果用户问城市知识或冷知识，必须调用此工具。"""
    c = norm_city(city)
    line = TRIVIA_TABLE.get(c)
    
    # 对应 JS 的 line ?? `没有为...` 
    trivia = line if line is not None else f"没有为「{c}」准备内置小知识，可换杭州/北京/上海试试。"
    
    return json.dumps({
        "city": c,
        "trivia": trivia
    }, ensure_ascii=False)


# ==========================================
# 创建子代理：Weather Agent
# ==========================================
from langgraph.prebuilt import create_react_agent

# 对应 JS 中的 createAgent
weather_agent = create_react_agent(

    model=default_model,
    tools=[lookup_weather],
    prompt="你只处理天气。用户提到城市时，用 lookup_weather 查询后再用中文简短说明。",
    name="weather_agent"
)

# ==========================================
# 创建子代理：Trivia Agent (城市小知识)
# ==========================================
trivia_agent = create_react_agent(
    model=default_model,
    tools=[lookup_city_trivia],
    prompt="你只讲城市小知识。先 lookup_city_trivia，再用人话转述，不要编造工具里没有的内容。",
    name="trivia_agent"
)

# ==========================================
# 提取一个通用的 create_supervisor 封装函数
# ==========================================
from modules.graph.graph_utils import create_supervisor


# ==========================================
# 使用我们自己写的极简语法糖组装网络！
# ==========================================
supervisor_prompt = """你是调度员，只负责选人，不要自己报气温、也不要自己讲城市百科。
- 问天气、气温、下不下雨、空气 → 用 weather_agent
- 问小知识、名胜、历史、一句介绍 → 用 trivia_agent
"""

graph = create_supervisor(
    model=default_model,
    agents={
        "weather_agent": weather_agent,
        "trivia_agent": trivia_agent
    },
    prompt=supervisor_prompt
)

if __name__ == "__main__":
    import asyncio
    
    async def main():
        print("=== 流程图 Mermaid 源码 ===")
        print(graph.get_graph().draw_mermaid())
        print("===========================\n")
        
        inputs = {"messages": [("user", "杭州天气怎么样？另外给我说个关于杭州的冷知识")]}
        
        async for event in graph.astream(inputs, stream_mode="values"):
            if "messages" in event and event["messages"]:
                event["messages"][-1].pretty_print()

    asyncio.run(main())
