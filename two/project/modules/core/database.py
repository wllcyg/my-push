from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from modules.config.settings import get_settings

_settings = get_settings()

_db_url = (
    f"mysql+asyncmy://{_settings.db_username}:{_settings.db_password}"
    f"@{_settings.db_host}:{_settings.db_port}/{_settings.db_database}"
)

engine = create_async_engine(
    _db_url,
    connect_args={
        # asyncmy 在 Windows 上通过 dict 方式接收 SSL 参数
        "ssl": {"ssl_disabled": False}
    },
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    echo=_settings.debug,
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
