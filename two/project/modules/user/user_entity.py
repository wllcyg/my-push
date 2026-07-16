from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from modules.core.database import Base


class User(Base):
    """
    用户实体 (对应 TypeORM 的 @Entity)
    映射数据库中的 users 表
    """
    __tablename__ = "users"

    # 对应 @PrimaryGeneratedColumn()
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="用户ID"
    )

    # 对应 @Column({ length: 50 })
    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="用户姓名"
    )

    # 对应 @Column({ length: 50 })
    email: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        comment="用户邮箱"
    )

    # 对应 @CreateDateColumn({ type: 'timestamp' })
    # 使用 Python 端默认值（insert_default），兼容没有 server DEFAULT 的数据库列
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
        comment="创建时间"
    )

    # 对应 @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
        comment="更新时间"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, name={self.name!r}, email={self.email!r})>"
