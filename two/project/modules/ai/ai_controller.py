from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse
from .ai_service import AiService
from modules.config.settings import Settings, get_settings

# 创建该模块的路由实例（相当于 NestJS 的 @Controller('ai')）
router = APIRouter(prefix="/ai", tags=["AI 对话模块"])

# 依赖提供者 (Provider)
def get_ai_service() -> AiService:
    return AiService()

# 流式输出 (SSE)
@router.get("/chat/stream")
def chat_stream(prompt: str, ai_service: AiService = Depends(get_ai_service)):
    """
    流式对话接口：使用 Server-Sent Events (SSE) 实时推送大模型的内容
    """
    def event_generator():
        # 调用 service 里的流式方法，获取生成器
        stream_chunks = ai_service.generate_reply_stream(prompt)
        
        import json
        for chunk in stream_chunks:
            # 过滤掉空字符串
            if not chunk:
                continue
            
            # 使用 JSON 序列化保证格式安全
            safe_data = json.dumps({"text": chunk}, ensure_ascii=False)
            
            # 只需要 yield 一个字典，sse-starlette 会自动拼成 "data: xxx\n\n"
            yield {"data": safe_data}
            
        # 可选：按照 OpenAI 习惯，最后推一条 [DONE] 表示结束
        yield {"data": "[DONE]"}

    # 直接返回 EventSourceResponse，它会帮你管理好 headers、断线检测等
    return EventSourceResponse(event_generator())

# 相当于 NestJS 的 @Get('chat')
@router.get("/chat")
def chat(prompt: str, ai_service: AiService = Depends(get_ai_service)):
    """
    Controller 层：负责接收 HTTP 请求、参数获取，然后委托给 Service 处理。
    """
    # 直接调用注入进来的 service 提供的方法
    return ai_service.generate_reply(prompt)

