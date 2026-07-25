import os
import sys

# 动态将项目根目录加入 python 模块搜索路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from modules.config.settings import get_settings

INIT_AUTH_SQL = """
-- 1. 确保 users 表存在
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 补全 password_hash 字段（若表已存在但缺失该列）
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3. 补全 updated_at 字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 4. 确保 email 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
"""

async def main():
    settings = get_settings()
    db_url = settings.database_url
    if not db_url:
        print("[ERROR] 未在配置中找到 database_url！")
        return

    print("正在连接 Supabase 初始化/更新用户认证表结构...")
    engine = create_async_engine(db_url, echo=False)

    try:
        async with engine.begin() as conn:
            statements = [stmt.strip() for stmt in INIT_AUTH_SQL.split(";") if stmt.strip()]
            for stmt in statements:
                await conn.execute(text(stmt))
        print("\n" + "=" * 50)
        print(" [SUCCESS] Supabase 用户表结构与 password_hash 字段更新成功！")
        print("=" * 50)
    except Exception as e:
        print(f"\n[FAILED] 用户表初始化失败: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
