import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from sqlalchemy import String, DateTime, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from modules.core.database import Base

JobType = Literal['cron', 'every', 'at']

class Job(Base):
    """
    定时任务实体
    映射数据库中的 jobs 表
    """
    __tablename__ = "jobs"

    # 对应 @PrimaryGeneratedColumn('uuid')
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4()),
        comment="主键 UUID"
    )

    # 对应 @Column({ type: 'text' })
    instruction: Mapped[str] = mapped_column(
        Text, 
        nullable=False,
        comment="任务指令"
    )

    # 对应 @Column({ type: 'varchar', length: 10, default: 'cron' })
    type: Mapped[JobType] = mapped_column(
        String(10), 
        default='cron',
        nullable=False,
        comment="任务类型: cron, every, at"
    )

    # cron 类型使用（Cron 表达式）
    cron: Mapped[Optional[str]] = mapped_column(
        String(100), 
        nullable=True,
        comment="Cron 表达式"
    )

    # every 类型使用（间隔毫秒）
    every_ms: Mapped[Optional[int]] = mapped_column(
        Integer, 
        nullable=True,
        comment="间隔毫秒"
    )

    # at 类型使用（指定触发时间点）
    at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, 
        nullable=True,
        comment="指定触发时间点"
    )

    # 对应 @Column({ default: true })
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, 
        default=True,
        nullable=False,
        comment="是否启用"
    )

    # 对应 @Column({ type: 'timestamp', nullable: true })
    last_run: Mapped[Optional[datetime]] = mapped_column(
        DateTime, 
        nullable=True,
        comment="上次运行时间"
    )

    # 对应 @CreateDateColumn
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
        comment="创建时间"
    )

    # 对应 @UpdateDateColumn
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
        comment="更新时间"
    )
    
    def __repr__(self) -> str:
        return f"<Job(id={self.id}, type={self.type}, is_enabled={self.is_enabled})>"
