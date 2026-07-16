import sys
import asyncio
from modules.core.database import engine, Base

# ✅ Windows 兼容
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ⚠️ 必须 import 所有 Entity，Base 才能感知到它们，进而建表
# 每新增一个 Entity 文件，就要在这里 import 一次
from modules.user.user_entity import User  # noqa: F401

async def init_db():
    async with engine.begin() as conn:
        # create_all 只会建不存在的表，不会删除或修改已有的表（安全）
        # ⚠️ 注意：生产环境推荐使用 alembic 做数据库迁移管理
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表初始化成功！")
    print("   已处理的表：", [t for t in Base.metadata.tables.keys()])

if __name__ == "__main__":
    asyncio.run(init_db())
