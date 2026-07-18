from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

# 1. 对齐 JS 的 StateAnnotation (使用标准的 TypedDict)
class State(TypedDict):
    tries: int
    ok: bool
    message: str

def attempt_node(state: State) -> dict:
    tries = state.get("tries", 0) + 1
    # 2. 对齐 JS 的 tries >= 3 判断
    ok = tries >= 3
    
    # 3. 对齐 JS 的消息动态拼接
    message = f"第 {tries} 次成功" if ok else f"第 {tries} 次失败，继续重试"
    
    return {"tries": tries, "ok": ok, "message": message}

workflow = StateGraph(State)
workflow.add_node("attempt", attempt_node)

workflow.add_edge(START, "attempt")

# 4. 对齐 JS 的路由函数和字典映射
workflow.add_conditional_edges(
    "attempt",
    lambda state: "done" if state.get("ok") else "retry",
    {
        "retry": "attempt",
        "done": END
    }
)

# 5. 对齐 JS 中加入的 MemorySaver (需在 compile 引入)
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)

if __name__ == "__main__":
    # 使用 checkpointer 后需要提供 thread_id
    result = graph.invoke(
        {"tries": 0, "ok": False, "message": ""}, 
        config={"configurable": {"thread_id": "1"}}
    )
    print("result:", result)
