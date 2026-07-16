"""
诊断脚本：跳过 SSL 验证，排查是否是证书导致的连接失败
"""
import asyncio
import ssl
import sqlalchemy
from sqlalchemy.ext.asyncio import create_async_engine
from modules.config.settings import get_settings

_settings = get_settings()

_db_url = (
    f"mysql+aiomysql://{_settings.db_username}:{_settings.db_password}"
    f"@{_settings.db_host}:{_settings.db_port}/{_settings.db_database}"
)

# ⚠️ 仅用于诊断！关闭 SSL 证书验证
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

_engine = create_async_engine(
    _db_url,
    connect_args={"ssl": _ssl_ctx},
    echo=True,
)

async def test():
    async with _engine.connect() as conn:
        result = await conn.execute(sqlalchemy.text("SELECT 1"))
        print("✅ 连接成功（跳过证书验证）:", result.scalar())

asyncio.run(test())
