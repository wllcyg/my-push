import sys
import asyncio
import sqlalchemy
from modules.core.database import engine

# ✅ Windows 上 ProactorEventLoop 与异步 SSL 有兼容性问题，切换为 SelectorEventLoop
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def test():
    async with engine.connect() as conn:
        result = await conn.execute(sqlalchemy.text("SELECT 1"))
        print("✅ TiDB Cloud 连接成功:", result.scalar())

asyncio.run(test())
