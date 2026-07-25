"""
Mem0 三种记忆作用域 (Scope) 测试脚本 (Python 封装版)

支持三种作用域：
1. 用户级别记忆 (User Scope): 仅绑定 user_id
2. 会话级别记忆 (Session / Run Scope): 同时绑定 user_id 与 run_id
3. Agent 级别记忆 (Agent Scope): 仅绑定 agent_id

用法说明：
- 写入记忆: python test_scoped_memory.py add
- 检索记忆: python test_scoped_memory.py search
- 清理数据: python test_scoped_memory.py --cleanup
"""

import sys
import json
import asyncio
from typing import Any

try:
    from .service import memory_service
except ImportError:
    from service import memory_service

# 测试常量
USER_ID = "mem0_test_user"
RUN_ID = "mem0_test_session"
AGENT_ID = "mem0_test_agent"


def log(title: str, data: Any):
    """格式化日志输出"""
    print(f"\n=== {title} ===")
    if isinstance(data, (dict, list)):
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(data)


# ------------------ 1. 用户级别记忆 (User Scope) ------------------

async def add_user_memory():
    messages = [
        {"role": "user", "content": "我叫小明，住在杭州，平时喜欢骑行和摄影。"},
        {"role": "assistant", "content": "好的，已记住你的姓名、城市和爱好。"}
    ]
    added = await memory_service.add_async(messages=messages, user_id=USER_ID)
    log("用户记忆 — add", added)


async def search_user_memory():
    # 语义检索
    searched = await memory_service.search_async(
        query="用户住在哪里，有什么爱好",
        user_id=USER_ID,
        limit=5
    )
    memories = [m.get("memory") for m in searched] if isinstance(searched, list) else searched
    log("用户记忆 — search", memories)

    # 获取全量
    listed = await memory_service.get_all_async(user_id=USER_ID)
    all_memories = [m.get("memory") for m in listed] if isinstance(listed, list) else listed
    log("用户记忆 — getAll", all_memories)


# ------------------ 2. 会话级别记忆 (Session Scope) ------------------

async def add_session_memory():
    messages = [
        {"role": "user", "content": "这次聊天先帮我把季度总结的大纲列出来，重点写 Q1 的项目复盘。"},
        {"role": "assistant", "content": "明白，我们先围绕 Q1 项目复盘整理季度总结大纲。"}
    ]
    added = await memory_service.add_async(
        messages=messages,
        user_id=USER_ID,
        run_id=RUN_ID
    )
    log("会话记忆 — add", added)


async def search_session_memory():
    # 检索绑定特定 run_id 的记忆
    searched = await memory_service.search_async(
        query="这次对话要先做什么",
        user_id=USER_ID,
        run_id=RUN_ID,
        limit=5
    )
    memories = [m.get("memory") for m in searched] if isinstance(searched, list) else searched
    log("会话记忆 — search (user_id + run_id)", memories)

    # 获取该会话下的全量记忆
    listed = await memory_service.get_all_async(user_id=USER_ID, run_id=RUN_ID)
    all_memories = [m.get("memory") for m in listed] if isinstance(listed, list) else listed
    log("会话记忆 — getAll", all_memories)


# ------------------ 3. Agent 级别记忆 (Agent Scope) ------------------

async def add_agent_memory():
    messages = [
        {"role": "user", "content": "你现在是旅行规划助手，回答时多给具体建议和备选方案。"},
        {"role": "assistant", "content": "好的，我会以旅行规划助手的身份，提供具体建议和备选方案。"}
    ]
    added = await memory_service.add_async(
        messages=messages,
        user_id=USER_ID,
        agent_id=AGENT_ID
    )
    log("Agent 记忆 — add", added)


async def search_agent_memory():
    searched = await memory_service.search_async(
        query="这个 Agent 的角色和回答方式",
        user_id=USER_ID,
        agent_id=AGENT_ID,
        limit=5
    )
    memories = [m.get("memory") for m in searched] if isinstance(searched, list) else searched
    log("Agent 记忆 — search (agent_id)", memories)

    listed = await memory_service.get_all_async(user_id=USER_ID, agent_id=AGENT_ID)
    all_memories = [m.get("memory") for m in listed] if isinstance(listed, list) else listed
    log("Agent 记忆 — getAll", all_memories)


# ------------------ 主程序入口 ------------------

async def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "add"

    if "--cleanup" in sys.argv:
        print("\n[CLEANUP] 正在清理数据...")
        user_memories = await memory_service.get_all_async(user_id=USER_ID)
        if isinstance(user_memories, list):
            for item in user_memories:
                if m_id := item.get("id"):
                    await memory_service.delete_async(m_id)
        log("清理完成", {"USER_ID": USER_ID, "RUN_ID": RUN_ID, "AGENT_ID": AGENT_ID})
        return

    if action == "add":
        print("[ADD] 开始提交 3 种 Scope 的记忆...")
        await add_user_memory()
        await add_session_memory()
        await add_agent_memory()
        print("\n[SUCCESS] add 请求完成！因 LLM 异步抽取处理，请稍等数秒后执行:")
        print("   uv run python mem0/test_scoped_memory.py search")
        return

    if action == "search":
        print("[SEARCH] 开始检索 3 种 Scope 的记忆...")
        await search_user_memory()
        await search_session_memory()
        await search_agent_memory()
        return

    print(f"[ERROR] 未知命令: {action}，可用命令: add | search | --cleanup")


if __name__ == "__main__":
    asyncio.run(main())
