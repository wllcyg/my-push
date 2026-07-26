from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from .session_entity import ChatSession, ChatMessage
from redis_service_module.agent_memory import RedisMessageStore

class SessionService:
    """
    会话存储服务：负责 Session 和 Message 的数据库读写与上下文转换，配合 Redis 实现旁路缓存 (Cache-Aside)
    """
    def __init__(self, db: AsyncSession, redis_store: Optional[RedisMessageStore] = None):
        self.db = db
        if redis_store is None:
            try:
                self.redis_store = RedisMessageStore(module_name="short_memory", ttl_seconds=1800)
            except Exception as e:
                print(f"⚠️ [SessionService] RedisMessageStore 初始化降级: {e}")
                self.redis_store = None
        else:
            self.redis_store = redis_store

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
        保存单条 Message 记录，落盘 DB 并在 Redis 中同步追加更新缓存
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

        # 同步回写 Redis 缓存
        if self.redis_store:
            try:
                cached_messages = self.redis_store.load_messages(session_id)
                if cached_messages is not None:
                    if role in ["user", "human"]:
                        new_msg = HumanMessage(content=content)
                    elif role == "assistant":
                        new_msg = AIMessage(content=content)
                    elif role == "system":
                        new_msg = SystemMessage(content=content)
                    else:
                        new_msg = None

                    if new_msg:
                        updated = cached_messages + [new_msg]
                        self.redis_store.save_messages(session_id, updated[-20:])
            except Exception as e:
                print(f"⚠️ [SessionService] 回写 Redis 缓存捕获非阻塞异常: {e}")

        return message

    async def get_history_messages(self, session_id: str, limit: int = 20) -> List[BaseMessage]:
        """
        从数据库或 Redis 获取某个 Session 的最近 N 条历史记录（优先读取 Redis 旁路缓存，未命中时查 DB 并回写缓存）
        （实现滑动窗口 Sliding Window 防止 Token 溢出）
        """
        # 1. 尝试从 Redis 旁路缓存获取 (Cache-Aside)
        if self.redis_store:
            try:
                cached_messages = self.redis_store.load_messages(session_id)
                if cached_messages is not None:
                    # 🎯 缓存命中 (Cache HIT)
                    return cached_messages[-limit:]
            except Exception as e:
                print(f"⚠️ [SessionService] 读取 Redis 缓存失败，降级至 DB: {e}")

        # 2. 缓存未命中 (Cache MISS)：从数据库获取
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

        # 3. 将从 DB 拿到的记录回写 Redis 缓存并置 TTL
        if self.redis_store and lc_messages:
            try:
                self.redis_store.save_messages(session_id, lc_messages)
            except Exception as e:
                print(f"⚠️ [SessionService] 回写 Redis 缓存失败: {e}")

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
