"""
AiService 集成 Mem0 记忆服务测试脚本
"""
import sys
import asyncio
from pathlib import Path

# 将项目根目录加入 Python 路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from modules.ai.ai_service import AiService
from modules.core.database import AsyncSessionFactory

async def run_test():
    print("=" * 60)
    print("🚀 开始测试 AiService 集成 Mem0 长期记忆功能")
    print("=" * 60)

    ai_svc = AiService()
    test_user_id = 1
    session_id = f"test_mem0_session_{int(asyncio.get_event_loop().time())}"

    async with AsyncSessionFactory() as db:
        # 第一轮提问：告诉 AI 用户的特征信息
        prompt1 = "你好，我是工程师小张，我平时最喜欢的编程语言是 Python。"
        print(f"\n[轮次 1] 用户发送: '{prompt1}'")
        res1 = await ai_svc.generate_reply_async(prompt1, user_id=test_user_id, session_id=session_id, db=db)
        await db.commit()
        print(f"🤖 [轮次 1] AI 回复:\n{res1['reply']}")

        # 等待 2 秒给后台 Task 写入 Mem0 留出异步时间
        print("\n⏳ 正在等待后台异步将对话归纳写入 Mem0 记忆库...")
        await asyncio.sleep(3)

        # 第二轮提问：使用同一个会话测试记忆
        prompt2 = "你知道我最喜欢的编程语言是什么吗？"
        print(f"\n[轮次 2] 用户发送: '{prompt2}'")
        res2 = await ai_svc.generate_reply_async(prompt2, user_id=test_user_id, session_id=res1["session_id"], db=db)
        await db.commit()
        print(f"🤖 [轮次 2] AI 回复:\n{res2['reply']}")

    print("\n" + "=" * 60)
    print("🎉 AiService 集成 Mem0 功能验证完毕！")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_test())
