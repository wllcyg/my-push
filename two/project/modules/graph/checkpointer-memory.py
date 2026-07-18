from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

# 对齐 JS 中的 StateAnnotation
# reducer: (_prev, next) => next 是 Python 的默认行为，无需特别指定。
class State(TypedDict):
    visitCount: int
    message: str


# 循环递增
def recored_visit(state: State) -> dict:
    visitcount = state.get("visitCount", 0) + 1
    message = f"第 {visitcount} 次访问"
    return {"visitCount": visitcount, "message": message}
    

workflow = StateGraph(State)
workflow.add_node("record_visit", recored_visit)

workflow.add_edge(START, "record_visit")
workflow.add_edge("record_visit", END)

# 1. 引入 MemorySaver
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)

if __name__ == "__main__":
    # 2. 定义不同用户的配置 (相当于 JS 里的 user1 和 user2)
    user1 = {"configurable": {"thread_id": "用户-小张"}}
    user2 = {"configurable": {"thread_id": "用户-小李"}}

    # 3. 模拟调用 (小张访问3次，小李访问1次)
    # 第一次传入空字典触发默认值机制，后面可以一直传空字典，记忆会自动把最新的 state 拿回来
    res1 = graph.invoke({"visitCount": 0, "message": ""}, config=user1)
    res2 = graph.invoke({}, config=user1)
    res3 = graph.invoke({}, config=user1)
    
    res4 = graph.invoke({"visitCount": 0, "message": ""}, config=user2)

    print("小张第1次:", res1)
    print("小张第2次:", res2)
    print("小张第3次:", res3)
    print("小李第1次:", res4)
