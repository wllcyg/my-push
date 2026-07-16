import sys
import asyncio
from modules.core.database import engine, Base
from modules.core.models import User

# ✅ Windows 兼容
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def init_db():
    async with engine.begin() as conn:
        # ⚠️ 注意：生产环境建议用 alembic 迁移。这里仅为开发测试时自动建表。
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表初始化成功！(users 表已建立)")

if __name__ == "__main__":
    asyncio.run(init_db())
