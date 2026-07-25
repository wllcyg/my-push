"""
Redis 聊天会话缓存 (Cache-Aside Pattern) 单元与集成测试脚本
"""
import sys
import os
import asyncio
import time
from pathlib import Path

# 将项目根目录加入 Python 路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from modules.core.database import AsyncSessionFactory
from modules.ai.session_service import SessionService
from redis.agent_memory import RedisMessageStore

async def run_tests():
    print("=" * 60)
    print("🚀 开始执行 Redis 聊天会话旁路缓存 (Cache-Aside) 集成测试")
    print("=" * 60)

    test_session_id = f"test_redis_session_{int(time.time())}"
    user_id = 1

    async with AsyncSessionFactory() as db:
        session_svc = SessionService(db)

        # 1. 验证获取/新建会话
        session = await session_svc.get_or_create_session(test_session_id, user_id)
        assert session is not None, "❌ 获取/创建 Session 失败"
        print(f"✅ 1. 成功创建测试 Session: id={session.id}")

        # 2. 模拟第 1 轮对话落盘 (User 发送消息)
        user_msg = await session_svc.save_message(session.id, "user", "你好，我是测试用户！")
        print(f"✅ 2. 用户消息已落盘 DB 并同步回写 Redis: '{user_msg.content}'")

        # 3. 模拟第 1 轮 AI 回复落盘
        ai_msg = await session_svc.save_message(session.id, "assistant", "你好！很高兴为你服务。")
        print(f"✅ 3. AI 消息已落盘 DB 并同步回写 Redis: '{ai_msg.content}'")

        # 4. 测试缓存读取 - 首次从 Redis 命中 (Cache HIT)
        start_time = time.perf_counter()
        messages_hit = await session_svc.get_history_messages(session.id, limit=20)
        elapsed_hit_ms = (time.perf_counter() - start_time) * 1000
        print(f"🎯 4. 从 Redis 读取历史 (Cache HIT): 获得 {len(messages_hit)} 条消息, 耗时 {elapsed_hit_ms:.2f}ms")
        assert len(messages_hit) == 2, f"❌ 应该包含 2 条历史消息，实际为 {len(messages_hit)}"
        assert messages_hit[0].content == "你好，我是测试用户！"
        assert messages_hit[1].content == "你好！很高兴为你服务。"

        # 5. 模拟 Redis 缓存 Key 被误删/过期的情况 (主动清空 Redis)
        if session_svc.redis_store:
            session_svc.redis_store.clear(session.id)
            print("⚡ 5. 模拟清空 Redis 缓存 Key (Cache MISS 状态)")

            # 6. 测试 Cache MISS -> 自动回源数据库装载 -> 重新写回 Redis
            start_time = time.perf_counter()
            messages_miss = await session_svc.get_history_messages(session.id, limit=20)
            elapsed_miss_ms = (time.perf_counter() - start_time) * 1000
            print(f"🔍 6. 缓存未命中后回源 DB 并重写 Redis (Cache MISS -> Reload): 获得 {len(messages_miss)} 条消息, 耗时 {elapsed_miss_ms:.2f}ms")
            assert len(messages_miss) == 2, "❌ DB 回源加载历史消息数量不匹配"

            # 7. 再次读取确认已重新写入 Redis (Cache HIT)
            start_time = time.perf_counter()
            messages_rehit = await session_svc.get_history_messages(session.id, limit=20)
            elapsed_rehit_ms = (time.perf_counter() - start_time) * 1000
            print(f"🎯 7. 再次读取确认已重新重装载至 Redis (Cache HIT): 耗时 {elapsed_rehit_ms:.2f}ms")
            assert len(messages_rehit) == 2, "❌ 重写后缓存读取失败"

        await db.commit()

    print("=" * 60)
    print("🎉 所有 Redis 旁路缓存测试用例全部通过！(ALL TESTS PASSED)")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_tests())
