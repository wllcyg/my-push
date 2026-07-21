
# 测试
from langchain_core.messages import SystemMessage
from langchain_core.messages import HumanMessage as LcHumanMessage
from langchain_core.messages import AIMessage as LcAIMessage
from modules.core.llm import default_model

from deep_agents_test.middleware.init import (
    create_agent,
    AgentMiddleware,
    hook_config,
    AIMessage,
    HumanMessage,
    ModelRequest,
    ModelResponse
)

# 1. 日志与模型调用次数统计
class LoggingMiddleware(AgentMiddleware):
    def before_agent(self, state, runtime=None):
        messages = state.get("messages", [])
        print(f"\n[Logging] agent 开始，消息数: {len(messages)}")
        # 顺便初始化状态
        return {"model_call_count": state.get("model_call_count", 0)}

    def before_model(self, state, runtime=None):
        messages = state.get("messages", [])
        count = state.get("model_call_count", 0)
        print(f"[Logging] 即将调用模型，当前消息数: {len(messages)}，已调用: {count} 次")

    def after_model(self, state, runtime=None):
        messages = state.get("messages", [])
        if messages:
            last = messages[-1]
            content_str = str(last.content)[:80]
            print(f"[Logging] 模型返回: {content_str}...")
        return {"model_call_count": state.get("model_call_count", 0) + 1}

    def after_agent(self, state, runtime=None):
        count = state.get("model_call_count", 0)
        print(f"[Logging] agent 结束，累计模型调用: {count} 次\n")


# 2. 在每次模型调用前追加 system 上下文
class AddContextMiddleware(AgentMiddleware):
    def wrap_model_call(self, request, handler):
        print("[AddContext] 注入额外 system 上下文")
        new_sys_prompt = request.system_prompt + "\n\n 请用一句话简洁回答。"
        new_request = request.override(system_prompt=new_sys_prompt)
        return handler(new_request)


# 3. 拦截敏感词，直接结束 agent
class BlockedContentMiddleware(AgentMiddleware):
    @hook_config(can_jump_to=["end"])
    def before_model(self, state, runtime=None):
        messages = state.get("messages", [])
        if messages:
            last_text = str(messages[-1].content)
            if "BLOCKED" in last_text:
                print("[Blocked] 检测到 BLOCKED，短路结束")
                return {
                    "messages": [AIMessage("该请求已被 middleware 拦截，无法处理。")],
                    "jump_to": "end"
                }


from deep_agents_test.middleware.adapters import create_langchain_adapter

import asyncio

async def main():
    agent = create_agent(
        model=create_langchain_adapter(default_model),
        tools=[],
        system_prompt="你是一个助手。",
        middleware=[
            LoggingMiddleware(),
            AddContextMiddleware(),
            BlockedContentMiddleware()
        ]
    )

    for text in ["你好", "给我看点BLOCKED的东西", "你是谁"]:
        print(f"\n用户: {text}")
        print("\n--- 流式输出 ---\n")
        
        async for event in agent.astream({"messages": [HumanMessage(text)]}):
            if event["event"] == "on_chat_model_stream":
                print(event["data"]["chunk"], end="", flush=True)
            elif event["event"] == "on_chain_end":
                output = event["data"]["output"]
                messages = output.get("messages", [])
                last_msg = messages[-1].content if messages else None
                print(f"\n\n回复: {last_msg}")

if __name__ == "__main__":
    asyncio.run(main())