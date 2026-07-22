from typing import Annotated, Optional, Any
from pydantic import BaseModel
from langchain_core.messages import BaseMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END, add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    structured_response: Optional[Any]  # 存储阶段 2 提炼出来的 Pydantic 结构化对象


def create_agent(
    llm, 
    tools, 
    system_prompt: str = "", 
    response_schema: type[BaseModel] | None = None
):
    """
    Agent 构建工厂。
    如果指定了 response_schema，自动启用【方案 1：两阶段解耦架构】：
    - 阶段 1 (agent + tools): ReAct 循环，自由推理并调用工具搜集数据。
    - 阶段 2 (formatter): 提炼阶段 1 的历史数据，用 with_structured_output 100% 格式化输出。
    """
    llm_with_tools = llm.bind_tools(tools)

    # 阶段 1：ReAct 思考与调工具节点
    async def agent_node(state: AgentState):
        messages = state["messages"]
        if system_prompt and not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=system_prompt)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", ToolNode(tools))

    workflow.set_entry_point("agent")
    workflow.add_edge("tools", "agent")

    # 如果配置了输出结构约束，自动挂载【阶段 2：格式化节点】
    if response_schema:
        # 使用 with_structured_output 绑定 Pydantic 模型，做硬约束
        structured_llm = llm.with_structured_output(response_schema)

        async def formatter_node(state: AgentState):
            messages = state["messages"]
            print("\n[Two-Stage Pipeline] 进入阶段 2：使用 100% 硬约束模型提炼结构化数据...")
            structured_data = await structured_llm.ainvoke(messages)
            
            return {
                "structured_response": structured_data,
                "messages": [AIMessage(content=f"【结构化输出结果】\n{structured_data}")]
            }

        workflow.add_node("formatter", formatter_node)

        # 自定义路由逻辑：需要调工具跳 'tools'，调完回到 'agent'；不需要调工具时跳 'formatter' 做硬约束提炼
        def route_after_agent(state: AgentState):
            next_step = tools_condition(state)
            if next_step == END:
                return "formatter"
            return next_step

        workflow.add_conditional_edges("agent", route_after_agent)
        workflow.add_edge("formatter", END)
    else:
        # 没有 response_schema，维持原本的标准 ReAct 流程
        workflow.add_conditional_edges("agent", tools_condition)

    return workflow.compile()

