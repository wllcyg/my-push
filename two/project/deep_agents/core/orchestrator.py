import asyncio
from typing import Dict, Any, List
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

def create_subagent_tools(subagents: Dict[str, Any], default_timeout: float = 90.0):
    """
    创建子 Agent 委派工具组 (包含单次委派工具与高并发并行委派工具)。
    
    Args:
        subagents: 字典映射，如 {"researcher": researcher_agent, "editor": editor_agent, "analyst": analyst_agent}
        default_timeout: 单个子 Agent 执行的绝对超时时间（秒），默认 90 秒熔断防卡死。
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
        
        try:
            res = await asyncio.wait_for(
                agent.ainvoke({"messages": [HumanMessage(content=query)]}),
                timeout=default_timeout
            )
            return res["messages"][-1].content
        except asyncio.TimeoutError:
            return f"【错误】：子 Agent '{subagent_type}' 执行超时（超过 {default_timeout}s），已被系统强行熔断以保障安全。"
        except Exception as e:
            return f"【错误】：子 Agent '{subagent_type}' 运行异常: {str(e)}"

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
            
            try:
                res = await asyncio.wait_for(
                    agent.ainvoke({"messages": [HumanMessage(content=query)]}),
                    timeout=default_timeout
                )
                return f"【子任务完成 ({query})】:\n" + res["messages"][-1].content
            except asyncio.TimeoutError:
                return f"【子任务超时 ({query})】:\n子 Agent '{stype}' 执行超过 {default_timeout}s，已被强行熔断。"
            except Exception as e:
                return f"【子任务异常 ({query})】:\n{str(e)}"

        results = await asyncio.gather(*[_run_single(t) for t in tasks])
        return "\n\n".join(results)

    return [delegate_task, delegate_tasks_parallel]

