import sys
import asyncio
from logging.config import fileConfig

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Alembic Config 对象
config = context.config

# 配置日志
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ✅ 关键配置：指向我们项目的 Base 和所有 Entity
# 每新增一个 Entity，在这里 import 一次，autogenerate 才能检测到变化
from modules.core.database import Base
from modules.user.user_entity import User  # noqa: F401
from modules.job.job_entity import Job  # noqa: F401

target_metadata = Base.metadata

# ✅ 从项目的 Settings 读取数据库连接 URL，不在 alembic.ini 里硬编码
from modules.core.database import _db_url
config.set_main_option("sqlalchemy.url", _db_url)


def run_migrations_offline() -> None:
    """离线模式：只生成 SQL 脚本，不实际连接数据库"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # compare_type=True 让 alembic 也能检测到字段类型的变化
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """在线模式：连接真实数据库执行迁移（使用异步引擎）"""
    connectable = create_async_engine(
        config.get_main_option("sqlalchemy.url"),
        connect_args={"ssl": {"ssl_disabled": False}},
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
