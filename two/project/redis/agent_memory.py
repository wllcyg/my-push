import sys
import os
import json
import asyncio
from typing import List, Optional, Dict, Any

# 将项目根目录加入 Python 模块搜索路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_core.tools import tool
from langchain_core.messages import (
    HumanMessage, 
    SystemMessage,
    BaseMessage, 
    messages_to_dict, 
    messages_from_dict
)
from deep_agents import create_agent
from modules.core.llm import default_model

# 引入项目自带的 EnterpriseRedisService (支持 Upstash Redis / 本地 Redis)
from redis.service import EnterpriseRedisService


class RedisMessageStore:
    """
    基于 Redis 的 Agent 短期记忆存储器 (Python 对标实现)
    负责 LangChain / DeepAgents 消息对象的 JSON 序列化、反序列化及 TTL 控制
    """

    def __init__(
        self, 
        redis_service: Optional[EnterpriseRedisService] = None, 
        module_name: str = "short_memory", 
        ttl_seconds: int = 1800
    ):
        if redis_service is None:
            from redis.service import redis_service as default_redis
            self.redis_service = default_redis
        else:
            self.redis_service = redis_service
        self.module_name = module_name
        self.ttl_seconds = ttl_seconds
        # 内存降级字典（当本地未配置 Redis 连接凭证时保底可用）
        self._memory_fallback = {}

    def load_messages(self, session_id: str) -> Optional[List[BaseMessage]]:
        """从 Redis 读取并反序列化 LangChain 消息列表。返回 None 表示 Cache Miss，返回 [] 表示空列表。"""
        dict_list = self.redis_service.get_json(self.module_name, session_id)
        if dict_list is None:
            dict_list = self._memory_fallback.get(session_id)

        if dict_list is None:
            return None

        if not dict_list:
            return []

        try:
            return messages_from_dict(dict_list)
        except Exception as e:
            print(f"❌ 解析历史消息失败: {e}")
            return []

    def save_messages(self, session_id: str, messages: List[BaseMessage]):
        """序列化消息列表并写回 Redis (带有 TTL 过期时间)"""
        dict_list = messages_to_dict(messages)
        success = self.redis_service.set_json(self.module_name, session_id, dict_list, ttl=self.ttl_seconds)
        if not success:
            # 当 Redis 未连接或异常时降级写本地内存
            self._memory_fallback[session_id] = dict_list

    def clear(self, session_id: str):
        """清空指定会话在 Redis 中的记忆"""
        self.redis_service.delete(self.module_name, session_id)
        self._memory_fallback.pop(session_id, None)


@tool
def get_weather(city: str) -> str:
    """查询指定城市的天气信息。"""
    return f"{city} 当前天气晴朗，温度 25℃。"


async def invoke_with_memory(agent, store: RedisMessageStore, session_id: str, user_text: str):
    """
    带记忆的 Agent 调用管道：
    1. 从 Redis 读取历史消息 history
    2. 拼接 [history + current_user_message]
    3. 调用 Agent 获取推理结果
    4. 若消息 >= 8 条，触发 LLM 自动总结摘要，并保存回 Redis 刷新 TTL
    """
    # 1. 加载历史
    history = store.load_messages(session_id)
    print(f"  ↳ 从 Redis 加载了 {len(history)} 条历史消息")

    # 2. 拼接当前提问
    current_messages = history + [HumanMessage(content=user_text)]

    # 3. 执行 Agent
    result = await agent.ainvoke({"messages": current_messages})

    # 4. 自动摘要压缩：当消息超过 8 条时，提炼前部对话为摘要
    updated_messages = result.get("messages", [])
    if len(updated_messages) >= 8:
        to_summarize = updated_messages[:-4]
        summary_res = await default_model.ainvoke(f"请用中文简短总结以下对话的关键信息与事实：\n{to_summarize}")
        summary_msg = SystemMessage(content=f"【前文对话摘要】：{summary_res.content}")
        updated_messages = [summary_msg] + updated_messages[-4:]
        print("  ⚡ 已触发 LLM 动态上下文摘要压缩")

    # 5. 写回 Redis 并更新 TTL
    store.save_messages(session_id, updated_messages)
    print(f"  ↳ 已将 {len(updated_messages)} 条最新消息写回 Redis (TTL {store.ttl_seconds}s)")

    return updated_messages


async def main():
    # 1. 初始化项目中的 Redis 服务与存储容器
    redis_service = EnterpriseRedisService(project_prefix="my_push")
    store = RedisMessageStore(redis_service=redis_service, ttl_seconds=1800)
    session_id = "demo_user_001"

    # 2. 结合 deep_agents 中的 create_agent 构建 Agent
    # 注：deep_agents 内置 max_context_messages 防溢出裁剪机制，效果等同于 TS 版的自动压缩
    agent = create_agent(
        llm=default_model,
        tools=[get_weather],
        system_prompt="你是会话助手。记住用户提到的关键事实，中文简短回答。",
        max_context_messages=10  # 超过 10 条消息自动触发深度上下文压缩/裁剪
    )

    print("=== 基于 Redis 的 Agent 记忆交互控制台 (Python 版) ===")
    print("输入 exit / quit / :q 退出，:clear 清空记忆\n")

    while True:
        try:
            user_text = input("你: ").strip()
        except (KeyboardInterrupt, EOFError):
            break

        if not user_text:
            continue

        if user_text.lower() in ["exit", "quit", ":q"]:
            break

        if user_text == ":clear":
            store.clear(session_id)
            print("已清空当前会话记忆\n")
            continue

        messages = await invoke_with_memory(agent, store, session_id, user_text)
        if messages:
            print(f"\n助手: {messages[-1].content}")
            print(f"当前会话消息数: {len(messages)}\n")


if __name__ == "__main__":
    asyncio.run(main())