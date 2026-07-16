from datetime import datetime
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from modules.core.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="用户ID")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="用户姓名")
    email: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, comment="用户邮箱")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
