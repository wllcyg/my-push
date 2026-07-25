"""
Redis 记这轮聊天，Mem0 记值得长期留着的事。

用户层 = 换天聊还认得你；会话层 = 只管当前这个聊天窗口。
集成项目自研 deep_agents 框架的 create_agent 实现。

依赖项目已有服务：
  - redis/service.py   → Upstash Redis 云端存储（HTTP REST 模式）
  - mem0/service.py    → Mem0 cloud SaaS (MemoryClient)

运行方式（在 two/project 目录下）:
    python -m mem0.memory

:clear      清 Redis 短期消息
:clear-mem0 清 Mem0 用户层与会话层
exit/:q     退出
"""

import os
import sys
import asyncio
import json
from typing import List, Dict, Any, Tuple, Optional
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    BaseMessage,
    SystemMessage,
    HumanMessage,
    AIMessage,
    messages_to_dict,
    messages_from_dict,
)

# ── 引入项目自研的 Agent 构造器 ──────────────────────────────────────────────
# 注意：直接从子模块导入，绕过 mem0_agent/__init__.py（该文件会导入 router.py）
try:
    from deep_agents.core.react_agent import create_agent
    from mem0_agent.service import memory_service        # ← 项目封装的 Mem0 服务单例
    from redis.service import redis_service              # ← 项目 Upstash Redis 单例
except ImportError:
    # 兼容直接单文件运行（python mem0_agent/memory.py）
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from deep_agents.core.react_agent import create_agent
    from mem0_agent.service import memory_service
    from redis.service import redis_service

# ── 加载环境变量 ─────────────────────────────────────────────────────────────
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# ── 配置常量 ─────────────────────────────────────────────────────────────────
MEMORY_TTL = int(os.getenv("MEMORY_TTL_SECONDS", 1800))

# Upstash Redis Key 规范：{prefix}:{session_id}:messages
# 使用 redis_service 内部的 module/key 分层机制
REDIS_MODULE = os.getenv("MEMORY_KEY_PREFIX", "agent:short_memory")

USER_ID = os.getenv("MEM0_USER_ID", "demo_user_001")
SESSION_ID = "session_002"
MEM0_TOP_K = int(os.getenv("MEM0_TOP_K", 5))

# 使用项目已有的 ALIYUN_API_KEY 作为 OpenAI-compatible 接口
MODEL_NAME = os.getenv("MODEL_NAME", os.getenv("OPEN_AI_MODEL_NAME", "glm-5"))
API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("ALIYUN_API_KEY")
BASE_URL = os.getenv("OPENAI_BASE_URL") or os.getenv("OPEN_AI_BASEUEL")


# ── 记忆分类 Pydantic Schema（对标 TS Zod memorySchema）────────────────────
class MemoryClassification(BaseModel):
    write_user: bool = Field(
        description=(
            "写入用户层：换一个新会话仍应保留的长期事实"
            "（身份、居住地、长期爱好、饮食禁忌、持久偏好）。不含仅本轮任务。"
        )
    )
    write_session: bool = Field(
        description=(
            "写入会话层：仅当前会话/thread 有效的任务、大纲、进度、待办、临时决策"
            "（如「这次先写…」「数据部分明天补」）。"
        )
    )
    reason: str = Field(description="分类理由，一句话")


CLASSIFIER_PROMPT = """你是记忆分层分类器。判断本轮对话是否有「新事实」需写入 Mem0，并分到正确层级。

## user 层（跨会话长期）
- 用户身份与画像：姓名、职业、居住地、长期爱好
- 长期偏好与约束：饮食过敏、回答风格、常用技术栈
- 持续数周以上的个人背景（非单次任务）

## session 层（仅当前会话）
- 当前正在做的任务、目标、文档大纲、方案草稿
- 本会话内的进度、决策、待办、临时约定
- 用户明确用「这次」「本轮」「当前会话」描述的工作上下文

## 均不写入
- 寒暄、致谢、纯确认
- 助手生成的通用内容（攻略、示例代码、建议清单），用户未明确采纳为新事实
- 无信息增量的复述

## 决策原则
1. 「这次我们先写 Q1 总结」「当前在排查 XX」→ 优先 session，不要标成 user
2. user 与 session 可同时为 true（如同时说职业+当前任务），但勿把纯会话任务只标 user
3. 一次性请求（如「帮我做旅行攻略」）且未产生需跨轮记住的约定 → 均为 false"""


def messages_for_redis(messages: List[BaseMessage]) -> List[BaseMessage]:
    """过滤掉 Mem0 注入的 SystemMessage，不写回 Redis"""
    return [m for m in messages if not isinstance(m, SystemMessage)]


# ── RedisMessageStore：对接项目 redis_service（Upstash HTTP REST）──────────
class RedisMessageStore:
    """
    利用项目已封装的 EnterpriseRedisService 来读写对话历史。
    redis_service 内部通过 upstash_redis 以 HTTPS REST 方式连接云端 Redis。
    """

    def __init__(self, service: Any, module: str, ttl_seconds: int):
        self.service = service          # EnterpriseRedisService 单例
        self.module = module            # 对应 redis_service._make_key 的 module 参数
        self.ttl_seconds = ttl_seconds

    def _session_key(self, session_id: str) -> str:
        return f"{session_id}:messages"

    async def load_messages(self, session_id: str) -> List[BaseMessage]:
        """从 Upstash Redis 加载当前 Session 的消息列表（异步 IO 线程）"""
        raw = await asyncio.to_thread(
            self.service.get_json, self.module, self._session_key(session_id)
        )
        if not raw:
            return []
        return messages_from_dict(raw)

    async def save_messages(self, session_id: str, messages: List[BaseMessage]):
        """将消息列表序列化后写入 Upstash Redis，并设置 TTL"""
        dicts = messages_to_dict(messages)
        await asyncio.to_thread(
            self.service.set_json,
            self.module,
            self._session_key(session_id),
            dicts,
            self.ttl_seconds,
        )

    async def clear(self, session_id: str):
        """删除当前 Session 的消息 Key"""
        await asyncio.to_thread(
            self.service.delete, self.module, self._session_key(session_id)
        )

    async def message_count(self, session_id: str) -> int:
        messages = await self.load_messages(session_id)
        return len(messages)


# ── Mem0MemoryStore：对接项目 memory_service（Mem0 Cloud SaaS）─────────────
class Mem0MemoryStore:
    def __init__(
        self,
        service: Any,
        user_id: str,
        session_id: str,
        top_k: int,
        classifier: Any,
    ):
        self.service = service
        self.user_id = user_id
        self.session_id = session_id
        self.top_k = top_k
        self.classifier = classifier

    async def search(self, query: str) -> Dict[str, List[Dict[str, Any]]]:
        """并发检索 user 长期层 + session 会话层"""
        user_res, session_res = await asyncio.gather(
            self.service.search_async(
                query=query, user_id=self.user_id, limit=self.top_k
            ),
            self.service.search_async(
                query=query,
                user_id=self.user_id,
                run_id=self.session_id,
                limit=self.top_k,
            ),
            return_exceptions=True,
        )
        return {
            "user": user_res if isinstance(user_res, list) else [],
            "session": session_res if isinstance(session_res, list) else [],
        }

    def build_system_message(
        self, memories: Dict[str, List[Dict[str, Any]]]
    ) -> Optional[SystemMessage]:
        """将召回的记忆拼装成 SystemMessage 动态注入 Prompt"""
        blocks = []
        user_items = [
            f"- {m.get('memory')}"
            for m in memories.get("user", [])
            if m.get("memory")
        ]
        session_items = [
            f"- {m.get('memory')}"
            for m in memories.get("session", [])
            if m.get("memory")
        ]
        if user_items:
            blocks.append("【用户长期记忆】\n" + "\n".join(user_items))
        if session_items:
            blocks.append("【当前会话记忆】\n" + "\n".join(session_items))
        if not blocks:
            return None
        return SystemMessage(
            content="\n\n".join(blocks) + "\n\n请结合以上记忆回答，勿编造。"
        )

    async def classify_and_persist(
        self, user_text: str, assistant_text: str
    ) -> Tuple[List[str], str]:
        """用结构化分类器判断是否写 Mem0 及写哪一层"""
        turn = [
            {"role": "user", "content": user_text},
            {"role": "assistant", "content": assistant_text},
        ]
        result: MemoryClassification = await self.classifier.ainvoke(
            [
                SystemMessage(content=CLASSIFIER_PROMPT),
                HumanMessage(content=f"用户：{user_text}\n助手：{assistant_text}"),
            ]
        )
        written = []
        if result.write_user:
            await self.service.add_async(messages=turn, user_id=self.user_id)
            written.append("user")
        if result.write_session:
            await self.service.add_async(
                messages=turn, user_id=self.user_id, run_id=self.session_id
            )
            written.append("session")
        return written, result.reason

    async def clear(self):
        """清除 Mem0 中当前用户的 user 层与 session 层所有记忆。
        memory_service 仅提供按 memory_id 删除，因此先 get_all 再逐条并发删除。
        """
        # 并发拉取两层的所有记忆条目
        user_mems, session_mems = await asyncio.gather(
            self.service.get_all_async(user_id=self.user_id),
            self.service.get_all_async(user_id=self.user_id, run_id=self.session_id),
            return_exceptions=True,
        )

        memory_ids = []
        for mem_list in [user_mems, session_mems]:
            if isinstance(mem_list, list):
                for m in mem_list:
                    mid = m.get("id") or m.get("memory_id")
                    if mid:
                        memory_ids.append(mid)

        if memory_ids:
            await asyncio.gather(
                *[self.service.delete_async(memory_id=mid) for mid in memory_ids],
                return_exceptions=True,
            )
        print(f"  已删除 {len(memory_ids)} 条 Mem0 记忆")


# ── 核心调用：读历史 → 注入记忆 → 执行 Agent → 写回 Redis → 分类持久化 Mem0 ──
async def invoke_with_memory(
    agent: Any,
    redis_store: RedisMessageStore,
    mem0_store: Mem0MemoryStore,
    session_id: str,
    user_text: str,
) -> Dict[str, Any]:

    # 1. 并行加载 Redis 历史 + Mem0 记忆检索
    history, mem = await asyncio.gather(
        redis_store.load_messages(session_id),
        mem0_store.search(user_text),
    )
    print(f"  ↳ Redis 加载 {len(history)} 条历史")
    if mem["user"]:
        print(f"  ↳ Mem0 用户层 {len(mem['user'])} 条")
    if mem["session"]:
        print(f"  ↳ Mem0 会话层 {len(mem['session'])} 条")

    # 2. 构造消息列表（动态 SystemMessage + 历史 + 当前输入）
    memory_msg = mem0_store.build_system_message(mem)
    invoke_messages: List[BaseMessage] = [
        *([memory_msg] if memory_msg else []),
        *history,
        HumanMessage(content=user_text),
    ]

    # 3. 调用项目自研 Agent（CompiledAgentWrapper.ainvoke）
    res = await agent.ainvoke({"messages": invoke_messages})
    out_messages: List[BaseMessage] = res["messages"]

    # 4. 过滤 SystemMessage 后写回 Upstash Redis
    redis_messages = messages_for_redis(out_messages)
    dropped = len(out_messages) - len(redis_messages)
    await redis_store.save_messages(session_id, redis_messages)

    dropped_str = f"（过滤 {dropped} 条 SystemMessage）" if dropped > 0 else ""
    print(f"  ↳ Redis 写回 {len(redis_messages)} 条{dropped_str}")

    # 5. 提取助手回复
    assistant_text = ""
    for msg in reversed(out_messages):
        if isinstance(msg, AIMessage) and msg.content:
            assistant_text = str(msg.content)
            break

    # 6. 分类写入 Mem0（异步非阻塞，不拦截主响应）
    asyncio.create_task(
        _persist_mem0(mem0_store, user_text, assistant_text)
    )

    return {
        "messages": out_messages,
        "redis_messages": redis_messages,
        "assistant_text": assistant_text,
    }


async def _persist_mem0(
    mem0_store: Mem0MemoryStore, user_text: str, assistant_text: str
):
    """后台任务：Mem0 分类与持久化，不阻塞主响应链路"""
    try:
        written, reason = await mem0_store.classify_and_persist(user_text, assistant_text)
        print(f"\n  [Mem0] 分类: {reason}")
        print(
            f"  [Mem0] 写入: {', '.join(written)}" if written else "  [Mem0] 未写入"
        )
    except Exception as e:
        print(f"\n  [Mem0] ⚠️ 持久化异常（不影响主对话）: {e}")


# ── 主程序入口 ───────────────────────────────────────────────────────────────
async def main():
    if not API_KEY:
        print("[ERROR] need ALIYUN_API_KEY or OPENAI_API_KEY")
        sys.exit(1)

    if not redis_service.get_client():
        print("[ERROR] Redis not connected, check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in .env")
        sys.exit(1)

    print("[OK] Upstash Redis 已连接")

    # ── 初始化存储层 ──────────────────────────────────────────────────────
    redis_store = RedisMessageStore(
        service=redis_service,
        module=REDIS_MODULE,
        ttl_seconds=MEMORY_TTL,
    )

    # ── 初始化 LLM ────────────────────────────────────────────────────────
    llm_kwargs = {"model": MODEL_NAME, "api_key": API_KEY, "temperature": 0}
    if BASE_URL:
        llm_kwargs["base_url"] = BASE_URL
    model = ChatOpenAI(**llm_kwargs)

    # ── 结构化分类器（with_structured_output 对标 TS withStructuredOutput）──
    classifier = model.with_structured_output(MemoryClassification)

    mem0_store = Mem0MemoryStore(
        service=memory_service,
        user_id=USER_ID,
        session_id=SESSION_ID,
        top_k=MEM0_TOP_K,
        classifier=classifier,
    )

    # ── 使用项目自研 create_agent 构建 Agent ──────────────────────────────
    agent = create_agent(
        llm=model,
        tools=[],
        system_prompt="你是会话助手。结合系统消息中的长期/会话记忆回答，中文简短。",
        max_context_messages=30,
        default_recursion_limit=25,
    )

    print(f"用户 {USER_ID} | 会话 {SESSION_ID}")
    print("输入 exit / quit / :q 退出；:clear 清空 Redis；:clear-mem0 清空 Mem0\n")

    prev_count = await redis_store.message_count(SESSION_ID)

    try:
        while True:
            try:
                user_input = input("你: ").strip()
            except (EOFError, KeyboardInterrupt):
                break

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", ":q"]:
                break

            if user_input == ":clear":
                await redis_store.clear(SESSION_ID)
                prev_count = 0
                print("✅ 已清空 Redis 短期记忆\n")
                continue

            if user_input == ":clear-mem0":
                await mem0_store.clear()
                print("✅ 已清空 Mem0 用户层与当前会话层\n")
                continue

            result = await invoke_with_memory(
                agent=agent,
                redis_store=redis_store,
                mem0_store=mem0_store,
                session_id=SESSION_ID,
                user_text=user_input,
            )

            redis_messages = result["redis_messages"]
            assistant_text = result["assistant_text"]

            print(f"\n助手: {assistant_text}")
            print(f"Redis 消息数: {len(redis_messages)}")
            if len(redis_messages) < prev_count + 2:
                print("  ⚡ 已触发自动裁剪与压缩")
            prev_count = len(redis_messages)
            print()

    finally:
        # 等待后台 Mem0 持久化任务完成后再退出
        await asyncio.gather(*asyncio.all_tasks() - {asyncio.current_task()},
                             return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())
