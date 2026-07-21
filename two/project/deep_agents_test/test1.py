
# 测试
from langchain_core.messages import SystemMessage
from langchain_core.messages import HumanMessage as LcHumanMessage
from langchain_core.messages import AIMessage as LcAIMessage
from modules.core.llm import default_model

from middleware.init import (
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


# 适配器：将 Middleware 引擎的请求转为 LangChain 格式并调用大模型
def model_adapter(request: ModelRequest) -> ModelResponse:
    lc_messages = []
    if request.system_prompt:
        lc_messages.append(SystemMessage(content=request.system_prompt))
    
    for m in request.messages:
        if m.role == "human":
            lc_messages.append(LcHumanMessage(content=m.content))
        elif m.role == "ai":
            lc_messages.append(LcAIMessage(content=m.content))
            
    # 调用 langchain model
    lc_response = default_model.invoke(lc_messages)
    
    # 包装为自定义的 AIMessage
    return AIMessage(
        content=lc_response.content,
        tool_calls=getattr(lc_response, "tool_calls", [])
    )


# 创建 Agent
agent = create_agent(
    model=model_adapter,
    tools=[],
    system_prompt="你是一个助手。",
    middleware=[
        LoggingMiddleware(),
        AddContextMiddleware(),
        BlockedContentMiddleware()
    ]
)

if __name__ == "__main__":
    for text in ["用中文说：middleware 是什么？", "这句话包含 BLOCKED 关键词"]:
        print(f"\n用户: {text}")
        result = agent.invoke({
            "messages": [HumanMessage(text)]
        })
        
        last_msg = result.get("messages", [])[-1]
        print(f"回复: {last_msg.content}")
        print(f"model_call_count: {result.get('model_call_count', 0)}")