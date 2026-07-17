from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any

from modules.chat.chat_service import ChatService

# 1. 创建 FastAPI 路由 (对标 NestJS 的 @Controller('ai'))
chat_router = APIRouter(prefix="/ai", tags=["AI Chat"])

# 实例化 Service (如果是大型项目，可以像 NestJS 那样做依赖注入，这里为了简单直接实例化)
chat_service = ChatService()

# 2. 定义前端发来的请求体 Schema (对标 NestJS 的 @Body)
class ChatRequest(BaseModel):
    # Vercel AI SDK 默认发送的数据格式是: { "messages": [{ "role": "user", "content": "你好" }] }
    messages: List[Dict[str, Any]]

@chat_router.post("/chat")
async def post_chat(request: ChatRequest):
    """
    接收前端 Vercel AI SDK 的 useChat 请求，并返回流式响应
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="Invalid JSON: messages array is required")

    # 3. 打印一下前端发来的真实数据，以防 Vercel 协议格式不对
    print("====== 前端发来的消息 ======")
    print(request.messages)
    print("==========================")

    # 4. 调用 Service 层，拿到我们手写的 Vercel 协议生成器
    stream_generator = chat_service.stream_chat(request.messages)
    
    # 4. 使用 StreamingResponse 吐给前端
    # 这里有个极其关键的 header：x-vercel-ai-data-stream: v1
    # 它会明确告诉前端的 useChat，这不仅是一个普通文本流，而是遵循 Vercel 0: 9: a: 等标记的数据流协议
    return StreamingResponse(
        stream_generator,
        media_type="text/plain; charset=utf-8",
        headers={
            "x-vercel-ai-data-stream": "v1"
        }
    )
