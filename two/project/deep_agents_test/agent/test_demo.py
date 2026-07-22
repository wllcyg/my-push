import asyncio
from langchain_core.tools import tool
from modules.core.llm import default_model  # 导入封装好的默认模型

# 导入核心模块
from deep_agents_test.agent.react_agent import create_agent
from deep_agents_test.agent.middlewares import apply_middlewares

# 1. 定义一个测试工具
@tool
def add_numbers(a: int, b: int) -> int:
    """计算两个数字相加之和"""
    return a + b

async def main():
    print("=== 开始使用系统封装的 default_model 运行 Agent 测试 ===")
    
    tools = [add_numbers]

    # 2. 步骤一：使用项目封装的 default_model 创建纯净的 React Agent 图
    raw_agent_graph = create_agent(default_model, tools, system_prompt="你是一个专业智能助手。")

    # 3. 步骤二：给 Agent 图挂载包含日志与敏感词拦截的包装器
    chat_agent = apply_middlewares(raw_agent_graph)

    # 4. 测试用例 1：正常对话（测试 Prompt 注入 + 日志打印）
    print("\n--- 测试用例 1：正常对话 ---")
    reply1 = await chat_agent("什么是 middleware？")
    print(f"\n【最终返回给用户的回复】:\n{reply1}")

    # 5. 测试用例 2：敏感词拦截（测试 Blocked 拦截）
    print("\n--- 测试用例 2：包含敏感词 BLOCKED ---")
    reply2 = await chat_agent("请分析包含 BLOCKED 的句子")
    print(f"\n【最终返回给用户的回复】:\n{reply2}")

if __name__ == "__main__":
    asyncio.run(main())
