from langchain_core.messages import SystemMessage, HumanMessage, AIMessage as LcAIMessage, ToolMessage
from langchain_core.tools import tool
from deep_agents_test.middleware.init import ModelRequest, AIMessage as CustomAIMessage

def create_langchain_adapter(langchain_llm):
    """把任意 LangChain 模型包装成符合 Middleware 引擎流式输出的适配器"""
    async def adapter(request: ModelRequest):
        lc_messages = []
        if request.system_prompt:
            lc_messages.append(SystemMessage(content=request.system_prompt))
        
        for m in request.messages:
            if m.role == "human":
                lc_messages.append(HumanMessage(content=m.content))
            elif m.role == "ai":
                lc_messages.append(LcAIMessage(content=m.content))
            elif m.role == "tool":
                lc_messages.append(ToolMessage(content=m.content, tool_call_id=getattr(m, "tool_call_id", "")))
                
        llm_to_run = langchain_llm
        if getattr(request, "tools", None):
            lc_tools = [tool(f) for f in request.tools]
            llm_to_run = llm_to_run.bind_tools(lc_tools)
            
        full_chunk = None
        # 使用 LangChain 的原生流式 API
        async for chunk in llm_to_run.astream(lc_messages):
            if full_chunk is None:
                full_chunk = chunk
            else:
                full_chunk += chunk
                
            if chunk.content:
                yield {"event": "on_chat_model_stream", "data": {"chunk": chunk.content}}
                
        # 结束时，提取最终的响应和工具调用
        final_content = full_chunk.content if full_chunk else ""
        tool_calls = getattr(full_chunk, "tool_calls", []) if full_chunk else []
        
        final_response = CustomAIMessage(
            content=final_content,
            tool_calls=tool_calls
        )
        yield {"event": "on_model_end", "data": {"response": final_response}}
        
    return adapter
