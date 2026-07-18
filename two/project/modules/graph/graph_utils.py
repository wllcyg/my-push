from typing import Literal, Dict, Any
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END, MessagesState
from langchain_core.runnables import Runnable

def create_supervisor(model: Runnable, agents: dict[str, Runnable], prompt: str):
    """
    仿照 JS 版本的封装：一键创建 Supervisor 主图
    :param model: 用于决策的大模型实例
    :param agents: 子代理字典，例如 {"weather_agent": weather_agent}
    :param prompt: Supervisor 的系统提示词
    """
    members = list(agents.keys())
    options = members + ["FINISH"]

    # 1. 动态生成结构化输出 Schema
    class RouteSchema(BaseModel):
        # 通过明确列出可选值，强制大模型做选择题
        next: str = Field(
            description=f"决定下一个由谁来处理。可选值必须精确匹配以下之一: {', '.join(options)}"
        )

    supervisor_chain = model.with_structured_output(RouteSchema)

    # 主图的 State 继承 MessagesState 并追加 next 字段
    class SupervisorState(MessagesState):
        next: str

    # 2. 定义调度节点
    async def supervisor_node(state: SupervisorState):
        messages = [{"role": "system", "content": prompt}] + state.get("messages", [])
        response = await supervisor_chain.ainvoke(messages)
        # 安全兜底：如果大模型胡言乱语，直接强制结束
        next_node = response.next if response.next in options else "FINISH"
        return {"next": next_node}

    workflow = StateGraph(SupervisorState)
    workflow.add_node("supervisor", supervisor_node)

    # 3. 动态挂载所有传入的子代理
    for name, agent in agents.items():
        # 使用默认参数锁定当前循环的 agent 实例，这是 Python 闭包的常见技巧
        async def call_agent(state: SupervisorState, current_agent=agent):
            result = await current_agent.ainvoke(state)
            return {"messages": result["messages"][-1]}
            
        workflow.add_node(name, call_agent)
        workflow.add_edge(name, "supervisor")

    # 4. 设置路由和流转
    workflow.add_edge(START, "supervisor")
    
    route_map = {member: member for member in members}
    route_map["FINISH"] = END
    
    workflow.add_conditional_edges("supervisor", lambda state: state["next"], route_map)

    return workflow.compile()
