import asyncio
from typing import Dict, Any, List
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

def create_subagent_tools(subagents: Dict[str, Any]):
    """
    创建子 Agent 委派工具组 (包含单次委派工具与高并发并行委派工具)。
    
    Args:
        subagents: 字典映射，如 {"researcher": researcher_agent, "editor": editor_agent, "analyst": analyst_agent}
    """
    
    @tool
    async def delegate_task(subagent_type: str, query: str) -> str:
        """委派单个任务给子 Agent。
        
        Args:
            subagent_type: 子 Agent 名称 (如 researcher, analyst, editor)
            query: 发给子 Agent 的具体任务描述
        """
        agent = subagents.get(subagent_type)
        if not agent:
            return f"错误：未知的子 Agent 类型 '{subagent_type}'"
        
        res = await agent.ainvoke({"messages": [HumanMessage(content=query)]})
        return res["messages"][-1].content

    @tool
    async def delegate_tasks_parallel(tasks: List[dict]) -> str:
        """批量【并行】委派多个任务给子 Agent（推荐同时启动多个调研员以大幅提升效率！）。
        
        Args:
            tasks: 字典列表，每个字典包含 `subagent_type` 和 `query`。
            示例: [
                {"subagent_type": "researcher", "query": "调研 LangGraph 的核心架构"},
                {"subagent_type": "researcher", "query": "调研 AutoGen 的核心架构"}
            ]
        """
        async def _run_single(task_item: dict):
            stype = task_item.get("subagent_type")
            query = task_item.get("query", "")
            agent = subagents.get(stype)
            if not agent:
                return f"错误：未知的子 Agent 类型 '{stype}'"
            
            res = await agent.ainvoke({"messages": [HumanMessage(content=query)]})
            return f"【子任务完成 ({query})】:\n" + res["messages"][-1].content

        results = await asyncio.gather(*[_run_single(t) for t in tasks])
        return "\n\n".join(results)

    return [delegate_task, delegate_tasks_parallel]
