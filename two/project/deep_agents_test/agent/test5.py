import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv

# 0. 加载环境变量
root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(root_dir / ".env")

from langchain_core.tools import tool
from modules.core.llm import default_model
from deep_agents_test.agent.react_agent import create_agent
from deep_agents_test.agent.middlewares import apply_middlewares

# ==========================================
# 1. 定义子 Agent 所需的基础数学工具
# ==========================================
@tool
def calc(a: float, b: float, op: str) -> str:
    """计算两个数的加减乘除。op 参数可选: add, subtract, multiply, divide"""
    ops = {
        "add": a + b,
        "subtract": a - b,
        "multiply": a * b,
        "divide": None if b == 0 else a / b,
    }
    res = ops.get(op)
    if res is None:
        return json.dumps({"error": "除数不能为0"})
    symbols = {"add": "+", "subtract": "-", "multiply": "×", "divide": "÷"}
    return json.dumps({"expression": f"{a} {symbols[op]} {b}", "result": res}, ensure_ascii=False)

@tool
def divide_evenly(total: float, parts: int) -> str:
    """把总数平均分成若干份，求每份多少"""
    if parts <= 0:
        return json.dumps({"error": "份数须大于0"})
    each = total / parts
    exact = (total % parts == 0)
    return json.dumps({
        "total": total, "parts": parts, "each": each, "exact": exact,
        "note": f"每人 {each}（整除）" if exact else f"每人 {each}（有余数）"
    }, ensure_ascii=False)

@tool
def make_similar_problem(template: str, seed: int) -> str:
    """生成一道同类应用题。template 可选: share_candy, group_buy"""
    n = (seed % 7) + 3
    problems = {
        "share_candy": {
            "stem": f"小刚有 {n * 4} 块糖，要分给 {n} 位同学，妈妈又买了 3 袋每袋 {n} 块的。每位同学现在能分到多少块？",
            "hint": "先算平分，再加上新增"
        },
        "group_buy": {
            "stem": f"班里有 {n} 个小组，每组先分到 {n * 5} 支铅笔，老师又补了 2 盒每盒 {n + 1} 支。每个小组现在有多少支？",
            "hint": "先算每组原有，再加上后来补的"
        }
    }
    picked = problems.get(template, problems["share_candy"])
    return json.dumps({"template": template, **picked}, ensure_ascii=False)

# ==========================================
# 2. 将子 Agent 包装成主 Agent 可以调用的超级工具 (Sub-Agent Proxy Tools)
# ==========================================

@tool
async def run_math_solver(problem: str) -> str:
    """解题子 Agent: 负责用 calc, divide_evenly 工具对小学应用题进行精准列式计算"""
    print("\n[SubAgent: math-solver] 正在精准计算题目...")
    solver_agent = create_agent(
        default_model, 
        tools=[calc, divide_evenly], 
        system_prompt="你是解题子 Agent。必须用 calc 和 divide_evenly 工具完成计算，不要自己心算。输出步骤与结果。"
    )
    res = await solver_agent.ainvoke({"messages": [("human", problem)]})
    return res["messages"][-1].content

@tool
async def run_kid_tutor(math_solution: str) -> str:
    """讲题子 Agent: 面向家长，把数学解法翻译成通俗、口语化的辅导话术"""
    print("\n[SubAgent: kid-tutor] 正在生成面向家长的讲题话术...")
    tutor_agent = create_agent(
        default_model, 
        tools=[], 
        system_prompt="你是讲题子 Agent，面向小学生家长。根据输入的解题过程，用通俗短句和比喻说明先算什么、再算什么。"
    )
    res = await tutor_agent.ainvoke({"messages": [("human", math_solution)]})
    return res["messages"][-1].content

@tool
async def run_practice_maker(request_desc: str) -> str:
    """出题子 Agent: 必须调用 make_similar_problem 工具生成 2 道同类练习题"""
    print("\n[SubAgent: practice-maker] 正在生成举一反三练习题...")
    maker_agent = create_agent(
        default_model, 
        tools=[make_similar_problem], 
        system_prompt="你是出题子 Agent。必须调用 make_similar_problem 工具至少 2 次生成练习题。"
    )
    res = await maker_agent.ainvoke({"messages": [("human", request_desc)]})
    return res["messages"][-1].content

# ==========================================
# 3. 运行主协调查 Agent (Supervisor Agent)
# ==========================================
async def main():
    print("=== 开始运行 Python 版 Multi-Agent (主子 Agent) 协作测试 ===")
    
    # 主 Agent 的工具就是 3 个子 Agent！
    subagent_tools = [run_math_solver, run_kid_tutor, run_practice_maker]
    
    main_agent_graph = create_agent(
        default_model, 
        tools=subagent_tools, 
        system_prompt="""你是小学数学辅导主 Agent。自己不直接解题。
你必须严格按顺序调用工具委派子 Agent：
1. 调用 run_math_solver 获取准确计算过程。
2. 调用 run_kid_tutor 将计算过程转化成教家长的辅导话术。
3. 调用 run_practice_maker 生成 2 道同类练习题。
最后将三者的结果优雅地汇总输出给家长。
"""
    )
    
    # 挂载全局中间件与日志
    chat_agent = apply_middlewares(main_agent_graph)

    user_query = "孩子遇到这道题：「小明有 24 块糖，平均分给 6 个同学；妈妈又买了 3 包糖，每包 5 块。每个同学现在一共有多少块？」"
    print(f"\n用户提问:\n{user_query}\n")
    
    reply = await chat_agent(user_query)
    print("\n" + "="*40)
    print("【主 Agent 最终给家长的汇总报告】:\n")
    print(reply)

if __name__ == "__main__":
    asyncio.run(main())
