import os
import sys
import json
import asyncio

# 动态将项目根目录加入 python 模块搜索路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from modules.config.settings import get_settings
from modules.core.llm import create_embeddings

VALID_ROLES = {"user", "assistant", "system"}

# -----------------------------------------------------------------------------
# 1. 用户 (Users) CRUD 模块
# -----------------------------------------------------------------------------
async def create_user(conn, name: str):
    stmt = text("INSERT INTO users (name) VALUES (:name) RETURNING *;")
    res = await conn.execute(stmt, {"name": name})
    return res.mappings().fetchone()

async def get_user_by_id(conn, user_id: int):
    stmt = text("SELECT * FROM users WHERE id = :id;")
    res = await conn.execute(stmt, {"id": user_id})
    return res.mappings().fetchone()

async def update_user(conn, user_id: int, name: str):
    stmt = text("UPDATE users SET name = :name WHERE id = :id RETURNING *;")
    res = await conn.execute(stmt, {"name": name, "id": user_id})
    return res.mappings().fetchone()

# -----------------------------------------------------------------------------
# 2. 会话 (Conversations) CRUD 模块
# -----------------------------------------------------------------------------
async def create_conversation(conn, user_id: int, title: str | None = None):
    stmt = text("INSERT INTO conversations (user_id, title) VALUES (:user_id, :title) RETURNING *;")
    res = await conn.execute(stmt, {"user_id": user_id, "title": title})
    return res.mappings().fetchone()

async def get_conversations_by_user_id(conn, user_id: int):
    stmt = text("SELECT * FROM conversations WHERE user_id = :user_id ORDER BY created_at DESC;")
    res = await conn.execute(stmt, {"user_id": user_id})
    return res.mappings().fetchall()

async def update_conversation(conn, conversation_id: int, title: str):
    stmt = text("UPDATE conversations SET title = :title WHERE id = :id RETURNING *;")
    res = await conn.execute(stmt, {"title": title, "id": conversation_id})
    return res.mappings().fetchone()

# -----------------------------------------------------------------------------
# 3. 消息与向量 (Messages & Vectors) CRUD 模块
# -----------------------------------------------------------------------------
async def create_message(conn, embeddings_model, conversation_id: int, role: str, content: str, with_embedding: bool = False):
    if role not in VALID_ROLES:
        raise ValueError(f"role 必须是 {', '.join(VALID_ROLES)} 之一")

    if with_embedding:
        # 使用项目封装的 create_embeddings() 异步生成向量
        vector = await embeddings_model.aembed_query(content)
        stmt = text("""
            INSERT INTO messages (conversation_id, role, content, embedding)
            VALUES (:conversation_id, :role, :content, CAST(:embedding AS vector))
            RETURNING id, conversation_id, role, content, created_at;
        """)
        res = await conn.execute(stmt, {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "embedding": json.dumps(vector)
        })
        return res.mappings().fetchone()

    stmt = text("""
        INSERT INTO messages (conversation_id, role, content)
        VALUES (:conversation_id, :role, :content)
        RETURNING *;
    """)
    res = await conn.execute(stmt, {
        "conversation_id": conversation_id,
        "role": role,
        "content": content
    })
    return res.mappings().fetchone()

async def get_messages_by_conversation_id(conn, conversation_id: int):
    stmt = text("""
        SELECT id, conversation_id, role, content, created_at 
        FROM messages 
        WHERE conversation_id = :conversation_id 
        ORDER BY created_at ASC;
    """)
    res = await conn.execute(stmt, {"conversation_id": conversation_id})
    return res.mappings().fetchall()

async def update_message(conn, message_id: int, content: str):
    stmt = text("UPDATE messages SET content = :content WHERE id = :id RETURNING *;")
    res = await conn.execute(stmt, {"content": content, "id": message_id})
    return res.mappings().fetchone()

async def search_similar_messages(conn, embeddings_model, conversation_id: int, search_text: str, limit: int = 5):
    # 1. 异步向量化搜索文本
    vector = await embeddings_model.aembed_query(search_text)
    
    # 2. 余弦距离相似度公式: 1 - (embedding <=> search_vector)
    stmt = text("""
        SELECT id, conversation_id, role, content, created_at,
               1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM messages
        WHERE conversation_id = :conversation_id AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit;
    """)
    res = await conn.execute(stmt, {
        "embedding": json.dumps(vector),
        "conversation_id": conversation_id,
        "limit": limit
    })
    return res.mappings().fetchall()

# -----------------------------------------------------------------------------
# 4. 主演示逻辑
# -----------------------------------------------------------------------------
async def main():
    settings = get_settings()
    if not settings.database_url:
        print("[ERROR] 未在配置中找到 database_url！")
        return

    # 初始化项目封装的 Embeddings 客户端 (匹配数据库 vector(1024) 维度)
    embeddings_model = create_embeddings(dimensions=1024)
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.begin() as conn:
        print("=== 用户 CRUD ===")
        user = await create_user(conn, "张三")
        print("创建用户:", dict(user))

        fetched_user = await get_user_by_id(conn, user["id"])
        print("查询用户:", dict(fetched_user))

        updated_user = await update_user(conn, user["id"], "李四")
        print("更新用户:", dict(updated_user))

        print("\n=== 会话 CRUD ===")
        conversation = await create_conversation(conn, user["id"], "第一次对话")
        print("创建会话:", dict(conversation))

        user_conversations = await get_conversations_by_user_id(conn, user["id"])
        print("用户的会话列表:", [dict(c) for c in user_conversations])

        updated_conversation = await update_conversation(conn, conversation["id"], "更新后的标题")
        print("更新会话:", dict(updated_conversation))

        print("\n=== 消息 CRUD ===")
        user_message = await create_message(conn, embeddings_model, conversation["id"], "user", "你好，请介绍一下 PostgreSQL")
        print("创建用户消息:", dict(user_message))

        assistant_message = await create_message(conn, embeddings_model, conversation["id"], "assistant", "PostgreSQL 是一个功能强大的开源关系型数据库。")
        print("创建 AI 消息:", dict(assistant_message))

        conversation_messages = await get_messages_by_conversation_id(conn, conversation["id"])
        print("会话消息列表:", [dict(m) for m in conversation_messages])

        updated_message = await update_message(conn, user_message["id"], "你好，请介绍一下 pgvector")
        print("更新消息:", dict(updated_message))

        print("\n=== 语义检索 ===")
        seed_messages = [
            {"role": "user", "content": "PostgreSQL 支持哪些数据类型？"},
            {
                "role": "assistant",
                "content": "PostgreSQL 支持整数、文本、JSON、数组，以及 pgvector 扩展提供的向量类型。",
            },
            {"role": "user", "content": "怎么做相似度搜索？"},
            {
                "role": "assistant",
                "content": "可以使用 pgvector 的 cosine 距离运算符 <=>，配合 hnsw 索引加速向量检索。",
            },
        ]

        for msg in seed_messages:
            await create_message(conn, embeddings_model, conversation["id"], msg["role"], msg["content"], with_embedding=True)
        print(f"已写入 {len(seed_messages)} 条带 embedding 的消息")

        search_queries = ["向量相似度怎么查", "关系型数据库有哪些类型"]

        for search_text in search_queries:
            print(f'\n搜索: "{search_text}"')
            results = await search_similar_messages(conn, embeddings_model, conversation["id"], search_text, limit=3)
            if not results:
                print("  无匹配结果")
                continue
            for i, row in enumerate(results, 1):
                sim = float(row["similarity"])
                print(f"  {i}. [{row['role']}] {row['content']} (similarity: {sim:.4f})")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
