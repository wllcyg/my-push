import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from modules.core.database import Base
from modules.user.user_entity import User  # noqa: F401

def generate_uuid() -> str:
    return str(uuid.uuid4())

class ChatSession(Base):
    """
    会话主表实体
    """
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    # 类型对齐 users.id (int)，外键指向 users.id 并支持级联删除
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="新对话")
    app_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联用户
    user: Mapped["User"] = relationship("User", backref="sessions")
    # 一对多关联 Message
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """
    会话消息明细表实体
    """
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False) # 'user' | 'assistant' | 'system' | 'tool'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # 多对一关联 Session
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")

