from typing import TypedDict
# 注意：原生 interrupt 和 Command 是在 langgraph.types 里的
from langgraph.types import interrupt, Command
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
import sys

# 定义 State，相当于 JS 中的 StateAnnotation
class State(TypedDict):
    actionSummary: str
    userInput:str
    
# 测试函数
def show_transfer(state:State) -> dict:
    return {
        "actionSummary":"向张三转账,200块,模拟数据",
    }

# 键盘输入函数
def wait_user_confirm(state: State) -> dict:
    text = interrupt({
        "hint": "终端里输入「确认」或备注后回车，图才会继续",
        "actionSummary": state.get("actionSummary")
    })
    return {
        "userInput":str(text)
    }

workflow = StateGraph(State)
workflow.add_node("show_transfer", show_transfer)
workflow.add_node("wait_confirm", wait_user_confirm)

workflow.add_edge(START, "show_transfer")
workflow.add_edge("show_transfer", "wait_confirm")
workflow.add_edge("wait_confirm", END)

# 原生 interrupt API 也必须搭配 MemorySaver
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)

if __name__ == "__main__":
    # 完全对齐 JS 里的 const config = ...
    config = {"configurable": {"thread_id": "interrupt-demo"}}
    
    # 执行图，遇到 interrupt() 停下
    graph.invoke({"userInput": ""}, config)
    
    # Python 里获取打断信息的方式：查状态里的 tasks
    state = graph.get_state(config)
    interrupt_value = None
    if state.tasks and state.tasks[0].interrupts:
        interrupt_value = state.tasks[0].interrupts[0].value
        
    print(f"\n待你确认： {interrupt_value}")
    
    # 模拟 node:readline 的 input 和判断
    line = input("> ").strip()
    
    if not line:
        print("未输入，退出。", file=sys.stderr) # 对齐 console.error
        sys.exit(1) # 对齐 process.exit(1)
        
    # 对齐: const done = await graph.invoke(new Command({ resume: line }), config);
    done = graph.invoke(Command(resume=line), config)
    print("结果：", done)