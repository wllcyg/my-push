import datetime
from deep_agents_test.middleware.init import (
    create_agent,
    AgentMiddleware,
    HumanMessage,
    ModelRequest,
    ModelResponse,
    AIMessage
)
from modules.core.llm import default_model
from langchain_core.messages import SystemMessage
from langchain_core.messages import HumanMessage as LcHumanMessage
from langchain_core.messages import AIMessage as LcAIMessage
from langchain_core.messages import ToolMessage as LcToolMessage
from langchain_core.tools import tool

# 1. 模拟工具函数
def get_current_time(**kwargs) -> str:
    """返回当前 UTC 时间的 ISO 8601 字符串"""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

# 2. 自定义 Middleware 实现工具拦截和包装
class ExtendedToolsMiddleware(AgentMiddleware):
    def __init__(self):
        # 对应 TS 中的 toolInvocationCount 状态
        # Python 版本目前是通过 state 追加/覆盖，或者保存在 middleware 实例内部
        self.tool_invocation_count = 0

    def wrap_tool_call(self, tool_call: dict, handler):
        tool_name = tool_call.get("name")
        args = tool_call.get("args", {})
        print(f"[Tools] 即将执行: {tool_name} args: {args}")
        
        # 统计调用次数
        self.tool_invocation_count += 1
        
        # 执行原函数
        result = handler(tool_call)
        
        # 包装结果 (对应 TS 中的新 ToolMessage 组装)
        wrapped_result = f"{result}\n[wrapToolCall] 已由 ExtendedToolsMiddleware 包装"
        
        preview = str(wrapped_result)[:120]
        print(f"[Tools] 执行完成: {tool_name} {preview}")
        
        return wrapped_result

    def after_agent(self, state, runtime=None):
        count = self.tool_invocation_count
        print(f"[Tools] agent 结束，middleware 统计工具调用: {count} 次")
        # 更新最终输出的状态
        return {"toolInvocationCount": count}


from deep_agents_test.middleware.adapters import create_langchain_adapter


import asyncio

async def main():
    agent = create_agent(
        model=create_langchain_adapter(default_model),
        tools=[get_current_time],  # 传入工具函数
        system_prompt="你是一个助手。",
        middleware=[ExtendedToolsMiddleware()]
    )

    for text in ["给我当前时间"]:
        print(f"\n用户: {text}")
        print("\n--- 流式输出 ---\n")
        
        async for event in agent.astream({"messages": [HumanMessage(text)]}):
            if event["event"] == "on_chat_model_stream":
                print(event["data"]["chunk"], end="", flush=True)
            elif event["event"] == "on_tool_start":
                print(f"\n\n→ {event['name']}\n")
            elif event["event"] == "on_chain_end":
                output = event["data"]["output"]
                messages = output.get("messages", [])
                last_msg = messages[-1].content if messages else None
                print(f"\n\n回复: {last_msg}")
                print(f"toolInvocationCount: {output.get('toolInvocationCount', 0)}")

if __name__ == "__main__":
    asyncio.run(main())
