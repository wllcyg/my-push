"""
AiService 意图识别节点 (detect_intent) 与智能分流入队测试脚本
"""
import sys
import asyncio
from pathlib import Path

# 将项目根目录加入 Python 搜索路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from modules.ai.ai_service import AiService
from modules.core.database import AsyncSessionFactory

async def run_test():
    print("=" * 60)
    print("🚀 开始测试 AiService 意图识别节点与智能分流")
    print("=" * 60)

    ai_svc = AiService()
    test_user_id = 1

    # 1. 测试常规短对话 (预期: 识别为 GENERAL_CHAT，即时生成)
    prompt_short = "你好，请用一句话告诉我什么是 Python。"
    print(f"\n[测试 1] 短问题输入: '{prompt_short}'")
    
    async with AsyncSessionFactory() as db:
        res1 = await ai_svc.generate_reply_async(prompt_short, user_id=test_user_id, db=db)
        await db.commit()

    print(f"   返回 status: {res1.get('status')}, is_async: {res1.get('is_async', False)}")
    print(f"   🤖 AI 即时回答: {res1.get('reply')[:60]}...")
    assert res1.get("is_async") is not True, "❌ 短问题不应该触发异步 MQ 入队！"

    # 2. 测试长耗时任务 (预期: 识别为 LONG_TASK，自动解耦压入 CloudAMQP)
    prompt_long = "请帮我撰写一份关于 2026 年企业级大模型架构演进的完整深度方案与总结提纲，字数要求尽可能详细。"
    print(f"\n[测试 2] 长任务输入: '{prompt_long}'")

    async with AsyncSessionFactory() as db:
        res2 = await ai_svc.generate_reply_async(prompt_long, user_id=test_user_id, db=db)
        await db.commit()

    print(f"   返回 status: {res2.get('status')}, is_async: {res2.get('is_async')}")
    print(f"   ⚡ Task ID: {res2.get('task_id')}")
    print(f"   📢 系统响应: {res2.get('reply')}")
    assert res2.get("is_async") is True, "❌ 长任务应该自动触发异步 MQ 入队！"

    print("\n" + "=" * 60)
    print("🎉 意图识别节点与智能分流功能全部验证通过！")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_test())
