import os
import sys

# 动态将项目根目录加入 python 模块搜索路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from modules.config.settings import get_settings

async def main():
    settings = get_settings()
    db_url = settings.database_url
    
    print("=" * 50)
    print("[1/3] 正在读取 Supabase 数据库配置...")
    if not db_url:
        print("[ERROR] 未在 .env 或 settings 中找到 database_url！")
        return

    # 脱敏打印连接地址
    masked_url = db_url.split("@")[-1] if "@" in db_url else db_url
    print(f"      目标数据库地址: ...@{masked_url}")

    print("\n[2/3] 正在连接 Supabase PostgreSQL 数据库...")
    engine = create_async_engine(db_url, echo=False)

    try:
        async with engine.connect() as conn:
            print("[3/3] 执行测试查询 (SELECT version(), current_database(), current_user)...")
            result = await conn.execute(text("SELECT version(), current_database(), current_user;"))
            row = result.fetchone()

            print("\n" + "=" * 50)
            print(" [SUCCESS] Supabase 数据库连接成功！")
            print("=" * 50)
            print(f" 数据库名称 : {row[1]}")
            print(f" 当前用户名 : {row[2]}")
            print(f" PgSQL 版本 : {row[0]}")
            print("=" * 50)

    except Exception as e:
        print("\n" + "=" * 50)
        print(" [FAILED] 连接 Supabase 数据库失败！")
        print(f" 错误详情: {e}")
        print("=" * 50)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
