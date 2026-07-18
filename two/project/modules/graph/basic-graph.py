# 请在这里跟着教程手敲代码
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
# 定义一个全局状态值
class State(TypedDict):
    text: str
    
# 定义节点
def step1(state: State) -> State:
    return {"text": f"hello, {state['text']} -> step1"}

def step2(state: State) -> State:
    return {"text": f"{state['text']} -> step2"}


workflow = StateGraph(State)
workflow.add_node("step1", step1)
workflow.add_node("step2", step2)

workflow.add_edge(START, "step1")
workflow.add_edge("step1", "step2")
workflow.add_edge("step2", END)

graph = workflow.compile()

if __name__ == "__main__":
    # 打印 Mermaid 图表
    try:
        mermaid_code = graph.get_graph().draw_mermaid()
        print("====== Mermaid 源码 ======")
        print(mermaid_code)
    except Exception as e:
        print("画图失败:", e)

    # 运行整个流
    result = graph.invoke({"text": "hello"})
    print("\n====== 最终结果 ======")
    print(result)
