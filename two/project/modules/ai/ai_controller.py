from typing import Optional
from fastapi import APIRouter, Depends, Query
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from modules.core.database import get_db
from .ai_service import AiService
from .session_entity import ChatSession, ChatMessage
import json

# 创建该模块的路由实例
router = APIRouter(prefix="/ai", tags=["AI 对话模块"])

# 依赖提供者 (Provider)
def get_ai_service() -> AiService:
    return AiService()

# ------------------------------------------------------------------
# 1. 历史会话管理 API
# ------------------------------------------------------------------

@router.get("/sessions")
async def get_user_sessions(
    user_id: int = Query(1, description="用户 ID (整数)"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户的【历史会话列表】(用于前端左侧边栏)
    """
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == user_id, ChatSession.is_deleted == False)
        .order_by(ChatSession.updated_at.desc())
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    return {
        "status": "success",
        "data": [
            {
                "session_id": s.id,
                "title": s.title,
                "app_name": s.app_name,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    获取某个会话的【全量历史消息明细】(用于前端右侧聊天视图)
    """
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return {
        "status": "success",
        "session_id": session_id,
        "data": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in messages
        ]
    }


# ------------------------------------------------------------------
# 2. 对话交互 API (带会话持久化与滑动窗口上下文)
# ------------------------------------------------------------------

@router.get("/chat/stream")
async def chat_stream(
    prompt: str, 
    user_id: int = Query(1, description="用户 ID (整数)"),
    session_id: Optional[str] = Query(None, description="会话 ID (可选，未传则自动新建)"),
    ai_service: AiService = Depends(get_ai_service)
):
    """
    流式对话接口：基于 SSE 实时推送消息，并在后台自动持久化历史上下文
    """
    stream_chunks, actual_session_id = await ai_service.generate_reply_stream(
        prompt=prompt,
        user_id=user_id,
        session_id=session_id
    )

    async def event_generator():
        async for chunk in stream_chunks:
            if not chunk:
                continue
            safe_data = json.dumps({"text": chunk, "session_id": actual_session_id}, ensure_ascii=False)
            yield {"data": safe_data}
            
        yield {"data": "[DONE]"}

    return EventSourceResponse(event_generator())



@router.get("/chat")
async def chat(
    prompt: str, 
    user_id: int = Query(1, description="用户 ID (整数)"),
    session_id: Optional[str] = Query(None, description="会话 ID (可选)"),
    ai_service: AiService = Depends(get_ai_service),
    db: AsyncSession = Depends(get_db)
):

    """
    同步对话接口：处理提问并持久化到数据库
    """
    return await ai_service.generate_reply_async(
        prompt=prompt,
        user_id=user_id,
        session_id=session_id,
        db=db
    )


@router.get('/get_user')
def get_user(user_id: str, ai_service: AiService = Depends(get_ai_service)):
    """
    管理员：查指定 ID 的用户信息与角色
    """
    return ai_service.get_user(user_id)


@router.get('/get_user_stream')
def get_user_stream(user_id: str, ai_service: AiService = Depends(get_ai_service)):
    """
    管理员：流式查用户信息与角色
    """
    async def event_generator():
        stream_gen = await ai_service.get_user_stream(user_id)
        async for chunk in stream_gen:
            if not chunk:
                continue
            safe_data = json.dumps({"text": chunk}, ensure_ascii=False)
            yield {"data": safe_data}
            
        yield {"data": "[DONE]"}

    return EventSourceResponse(event_generator())

