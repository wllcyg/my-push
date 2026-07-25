from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from .session_entity import ChatSession, ChatMessage

class SessionService:
    """
    会话存储服务：负责 Session 和 Message 的数据库读写与上下文转换
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_session(self, session_id: Optional[str], user_id: int, app_name: str = "My Push App") -> ChatSession:
        """
        获取或新建 Session
        """
        if session_id:
            stmt = select(ChatSession).where(ChatSession.id == session_id, ChatSession.is_deleted == False)
            result = await self.db.execute(stmt)
            chat_session = result.scalar_one_or_none()
            if chat_session:
                return chat_session

        # 如果没有找到或未传，创建新 Session
        new_session = ChatSession(
            user_id=user_id,
            app_name=app_name,
            title="新对话"
        )
        self.db.add(new_session)
        await self.db.flush()
        return new_session


    async def save_message(self, session_id: str, role: str, content: str) -> ChatMessage:
        """
        保存单条 Message 记录
        """
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content
        )
        self.db.add(message)
        
        # 同时更新 Session 的 updated_at
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        if session:
            from datetime import datetime
            session.updated_at = datetime.utcnow()

        await self.db.flush()
        return message

    async def get_history_messages(self, session_id: str, limit: int = 20) -> List[BaseMessage]:
        """
        从数据库获取某个 Session 的最近 N 条历史记录，并转换为 LangChain BaseMessage 格式
        （实现滑动窗口 Sliding Window 防止 Token 溢出）
        """
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        # 颠倒恢复成时间正序 (最早的在前面)
        db_messages = list(reversed(result.scalars().all()))

        lc_messages: List[BaseMessage] = []
        for msg in db_messages:
            if msg.role == "user" or msg.role == "human":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))
            elif msg.role == "system":
                lc_messages.append(SystemMessage(content=msg.content))

        return lc_messages

    async def update_session_title_if_needed(self, session_id: str, first_prompt: str):
        """
        如果是新会话的第一轮对话，自动根据首句 prompt 提取短标题
        """
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        if session and session.title == "新对话":
            # 简单截取前 15 个字作为标题（实际生产中可调用 LLM 总结）
            session.title = first_prompt[:15] + ("..." if len(first_prompt) > 15 else "")
            await self.db.flush()
