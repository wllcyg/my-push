from typing import Annotated, Optional, Any
from pydantic import BaseModel
from langchain_core.messages import BaseMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END, add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

from deep_agents.middlewares.context import trim_context_messages


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    structured_response: Optional[Any]  # 存储阶段 2 提炼出来的 Pydantic 结构化对象


def _check_tool_loop(messages: list[BaseMessage], max_repeats: int = 3) -> bool:
    """检查最近的 AIMessage 是否陷入连续重复调用同一工具参数的死循环"""
    recent_calls = []
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                # 记录 (tool_name, args_str)
                key = (tc.get("name"), str(tc.get("args")))
                recent_calls.append(key)
                if len(recent_calls) >= max_repeats:
                    # 如果最近 max_repeats 次调用完全一致
                    if len(set(recent_calls[:max_repeats])) == 1:
                        return True
        elif isinstance(msg, SystemMessage):
            continue
    return False


class CompiledAgentWrapper:
    """包装 CompiledStateGraph，默认注入 recursion_limit 保护"""
    def __init__(self, compiled_graph, default_recursion_limit: int = 25):
        self._graph = compiled_graph
        self.default_recursion_limit = default_recursion_limit

    async def ainvoke(self, input: Any, config: Optional[dict] = None, **kwargs: Any) -> Any:
        if config is None:
            config = {}
        if "recursion_limit" not in config:
            config["recursion_limit"] = self.default_recursion_limit
        return await self._graph.ainvoke(input, config=config, **kwargs)

    def invoke(self, input: Any, config: Optional[dict] = None, **kwargs: Any) -> Any:
        if config is None:
            config = {}
        if "recursion_limit" not in config:
            config["recursion_limit"] = self.default_recursion_limit
        return self._graph.invoke(input, config=config, **kwargs)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._graph, name)


def create_agent(
    llm, 
    tools, 
    system_prompt: str = "", 
    response_schema: type[BaseModel] | None = None,
    max_context_messages: int = 30,
    default_recursion_limit: int = 25,
    max_same_tool_calls: int = 3,
):
    """
    Agent 构建工厂。
    如果指定了 response_schema，自动启用【两阶段解耦架构】：
    - 阶段 1 (agent + tools): ReAct 循环，自由推理并调用工具搜集数据。
    - 阶段 2 (formatter): 提炼阶段 1 的历史数据，用 with_structured_output 100% 格式化输出。
    """
    llm_with_tools = llm.bind_tools(tools)

    # 阶段 1：ReAct 思考与调工具节点
    async def agent_node(state: AgentState):
        messages = state["messages"]
        if system_prompt and not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=system_prompt)] + messages
            
        # 自动触发上下文裁剪与压缩防溢出
        messages = trim_context_messages(messages, max_messages=max_context_messages)

        # 防死循环检测：如果发现历史记录中连续多次调用完全相同的工具参数
        if _check_tool_loop(messages, max_repeats=max_same_tool_calls):
            warning_msg = AIMessage(
                content="【系统防死循环拦截】：检测到连续多次尝试完全相同的工具调用，已被系统强行熔断。请直接基于已获取的信息给出最终答复或结论。"
            )
            return {"messages": [warning_msg]}

        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", ToolNode(tools))

    workflow.set_entry_point("agent")
    workflow.add_edge("tools", "agent")

    # 条件路由逻辑：带防死循环逻辑
    def route_after_agent(state: AgentState):
        messages = state["messages"]
        last_msg = messages[-1] if messages else None
        # 如果最后一条消息是被系统强行熔断的 Warning Message，直接终止
        if isinstance(last_msg, AIMessage) and "【系统防死循环拦截】" in last_msg.content:
            return "formatter" if response_schema else END

        next_step = tools_condition(state)
        if next_step == END:
            return "formatter" if response_schema else END
        return next_step

    # 如果配置了输出结构约束，自动挂载【阶段 2：格式化节点】
    if response_schema:
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
        workflow.add_conditional_edges("agent", route_after_agent)
        workflow.add_edge("formatter", END)
    else:
        workflow.add_conditional_edges("agent", route_after_agent)

    compiled_graph = workflow.compile()
    return CompiledAgentWrapper(compiled_graph, default_recursion_limit=default_recursion_limit)
