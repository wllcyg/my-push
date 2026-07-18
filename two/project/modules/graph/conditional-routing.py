from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
import re
class State(TypedDict):
    query: str
    route: str
    answer: str

# 路由分支
def router(state: State) -> State:
    # 修复了这里的正则，匹配加、减、乘、除任意一个符号
    is_math = bool(re.search(r"[+\-*/]", state['query']))
    return {"route": "math" if is_math else "chat"}

# 数学计算
def math_node(state: State) -> State:
    try:
        # 注意：eval 在生产环境中非常危险，仅限学习测试使用！
        # 如果是真实项目，请用大模型的 Tool 调用或安全的数学解析库
        result = str(eval(state["query"]))
        return {"answer": result}
    except Exception:
        return {"answer": "表达式无法计算"}

# 对话节点
def chat_node(state: State) -> State:
    return {"answer": f"你说得是 {state['query']}"}

# 流程图定义
workflow = StateGraph(State)
workflow.add_node("router", router)
workflow.add_node("math_node", math_node)
workflow.add_node("chat_node", chat_node)
# 定义边的调用关系：START -> router -> math_node 或 chat_node -> END
workflow.add_edge(START, "router")
# 使用 conditional_edges 实现动态跳转
workflow.add_conditional_edges(
    "router",
    lambda state: state["route"],   # 这一行是关键！它会根据 router 返回的值决定跳到哪里
    {
        "math": "math_node",
        "chat": "chat_node",
    },
)
workflow.add_edge("math_node", END)
workflow.add_edge("chat_node", END)

graph = workflow.compile()


if __name__ == "__main__":
    # 打印 Mermaid 图表
    try:
        mermaid_code = graph.get_graph().draw_mermaid()
        print("====== Mermaid 源码 ======")
        print(mermaid_code)
        print("==============================\n")
    except Exception as e:
        print("画图失败:", e)

    # 测试 1: 数学运算
    print("=== 测试数学运算 ===")
    result_math = graph.invoke({"query": "1+2*3"})
    print(f"用户：1+2*3")
    print(f"AI 回答：{result_math['answer']}")
    # 测试 2: 普通对话
    print("\n=== 测试普通对话 ===")
    result_chat = graph.invoke({"query": "你好，介绍一下 LangGraph"})
    print(f"用户：你好，介绍一下 LangGraph")
    print(f"AI 回答：{result_chat['answer']}")
