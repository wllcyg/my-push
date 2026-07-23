import os
import sys

# 动态将项目根目录加入 python 模块搜索路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from modules.config.settings import get_settings

INIT_SQL = """
-- 1. 启用 pgvector 向量扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 会话表
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversations_user 
        FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE CASCADE
);

-- 4. 消息表（带向量）
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    embedding vector(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_conversation 
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) 
        ON DELETE CASCADE
);

-- 5. 向量索引 (HNSW 算法加速余弦相似度搜索)
CREATE INDEX IF NOT EXISTS idx_messages_embedding 
ON messages USING hnsw (embedding vector_cosine_ops);
"""

async def main():
    settings = get_settings()
    db_url = settings.database_url
    if not db_url:
        print("[ERROR] 未找到 database_url 配置！")
        return

    print("正在连接 Supabase 并初始化建表...")
    engine = create_async_engine(db_url, echo=True)

    try:
        async with engine.begin() as conn:
            # 拆分为单独的 SQL 语句分别执行，确保相容性
            statements = [stmt.strip() for stmt in INIT_SQL.split(";") if stmt.strip()]
            for stmt in statements:
                await conn.execute(text(stmt))
        print("\n" + "=" * 50)
        print(" [SUCCESS] 向量数据库建表及索引初始化完成！")
        print("=" * 50)
    except Exception as e:
        print(f"\n[FAILED] 初始化失败: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
