import json
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from modules.core.llm import default_model
from modules.ai.tools import ALL_TOOLS
from langgraph.prebuilt import create_react_agent 

class ChatService:
    def __init__(self):
        self.tools = ALL_TOOLS
        self.model = default_model
        
        self.system_prompt = "你是 AI 助手，请根据用户的提问进行专业解答。必要时可以使用工具。"
        
        # 使用 LangGraph 内置的 create_react_agent
        # 这样它会自动在内部处理 "思考 -> 调工具 -> 总结" 的死循环逻辑，不需要我们自己处理
        self.agent = create_react_agent(
            model=self.model,
            tools=self.tools
        )

    async def stream_chat(self, ui_messages: list[dict]):
        # 1. 协议转换 (入)：Vercel UIMessage -> LangChain BaseMessage
        # 把人设提示词作为第一条消息注入
        lc_messages = [SystemMessage(content=self.system_prompt)]
        
        for msg in ui_messages:
            role = msg.get("role")
            
            # 兼容 Vercel SDK V3+ 格式，它把文本放到了 parts 数组里而不是 content
            content = msg.get("content", "")
            if not content and "parts" in msg:
                text_parts = [p.get("text", "") for p in msg.get("parts", []) if p.get("type") == "text"]
                content = "".join(text_parts)

            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=content))

        # 2. 调起 LangGraph Agent，使用 stream_mode="messages" 捕获内部的所有消息流
        # astream 会返回一个异步生成器
        agent_stream = self.agent.astream(
            {"messages": lc_messages},
            stream_mode="messages"
        )
        
        # 3. 协议转换 (出)：LangGraph Chunk -> Vercel Data Stream Protocol
        async for chunk, metadata in agent_stream:
            # metadata 里会告诉你当前这个 chunk 是谁发出的（比如 'agent' 代表大模型，'tools' 代表工具执行的结果）
            node_name = metadata.get("langgraph_node")
            
            if node_name == "agent":
                # 只将大模型的纯文本思考过程吐给前端，作为打字机效果
                if chunk.content and isinstance(chunk.content, str):
                    yield f'0:{json.dumps(chunk.content)}\n'
                
                # Vercel 高阶用法: 告诉前端正在调用工具
                if getattr(chunk, "tool_calls", None):
                    for tool_call in chunk.tool_calls:
                        tool_call_payload = {
                            "toolCallId": tool_call.get("id"),
                            "toolName": tool_call.get("name"),
                            "args": tool_call.get("args")
                        }
                        # '9:' 代表 Tool Call 发起，Vercel 协议要求是数组格式
                        yield f'9:{json.dumps([tool_call_payload])}\n'

            elif node_name == "tools":
                # 工具执行完毕的数据，返回给前端让前端也知道工具执行结果
                if hasattr(chunk, "tool_call_id"):
                    tool_result_payload = {
                        "toolCallId": chunk.tool_call_id,
                        "result": chunk.content
                    }
                    # 'a:' 代表 Tool Result，Vercel 协议要求是数组格式
                    yield f'a:{json.dumps([tool_result_payload])}\n'
