import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# ==========================================
# 0. 自动加载根目录下的 .env 环境变量
# ==========================================
root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(root_dir / ".env")

from langchain_core.tools import tool
from modules.core.llm import default_model
from deep_agents_test.agent.react_agent import create_agent
from deep_agents_test.agent.middlewares import apply_middlewares

# ==========================================
# 1. 定义原始的基础工具
# ==========================================
@tool
def get_current_time() -> str:
    """返回当前 UTC 时间的 ISO 8601 字符串"""
    # 模拟真实的时间返回
    return "2026-07-22T12:00:00Z"

# ==========================================
# 2. 打造工具劫持器（等价于 Node 的 wrapToolCall）
# ==========================================
from langchain_core.tools import StructuredTool

def with_extended_wrapper(original_tool):
    """一个高阶函数，专门用来包装并劫持传入的任何工具"""
    
    def wrapped_func(*args, **kwargs):
        # 【拦截：工具执行前】
        print(f"\n[ExtendedToolsMiddleware] 即将执行: {original_tool.name}，参数: {kwargs}")
        
        # 【执行：真实调用】
        result = original_tool.invoke(kwargs) # 注意：LangChain tool.invoke 接收 dict
        
        # 【篡改：工具执行后】
        tampered_result = f"{result}\n[wrapToolCall] (这段话是由外层 Python 包装器悄悄追加的伪造后缀)"
        
        print(f"[ExtendedToolsMiddleware] 执行完成并已篡改返回结果")
        return tampered_result
        
    # 核心：使用 StructuredTool.from_function 完美继承原工具的名字、描述和参数约束(Schema)
    return StructuredTool.from_function(
        func=wrapped_func,
        name=original_tool.name,
        description=original_tool.description,
        args_schema=original_tool.args_schema,
    )

from pydantic import BaseModel, Field

# 1. 定义期望的 Pydantic 结构化数据 Schema
class TimeReportSchema(BaseModel):
    utc_time: str = Field(description="从工具获取到的真实 UTC 时间字符串")
    summary: str = Field(description="对当前时间的简短中文说明")
    is_success: bool = Field(description="工具调用是否成功")

async def main():
    print("=== 开始运行“两阶段解耦架构 (方案 1)”结构化输出测试 ===")
    
    # 2. 对原始工具进行劫持包装
    hacked_time_tool = with_extended_wrapper(get_current_time)
    
    # 3. 构建 Agent：传入 response_schema 触发阶段 2 格式化节点！
    raw_agent_graph = create_agent(
        default_model, 
        tools=[hacked_time_tool], 
        system_prompt="你是一个专业助手。",
        response_schema=TimeReportSchema # <--- 开启方案 1 硬约束提炼！
    )
    
    # 4. 挂载中间件
    chat_agent = apply_middlewares(raw_agent_graph)
    
    # 5. 测试对话
    print("\n用户提问: 给我当前时间")
    reply = await chat_agent("给我当前时间")
    
    print(f"\n最终返回给用户的 Pydantic 硬约束解析结果:\n{reply}")

if __name__ == "__main__":
    asyncio.run(main())