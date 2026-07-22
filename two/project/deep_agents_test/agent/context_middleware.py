from typing import List
from langchain_core.messages import BaseMessage, SystemMessage, trim_messages

def trim_context_messages(
    messages: List[BaseMessage], 
    max_messages: int = 30
) -> List[BaseMessage]:
    """
    上下文自动裁剪与压缩中间件。
    
    规则：
    1. 保持 SystemMessage（系统 Prompt、技能规范、长期记忆）处于列表头部不丢失。
    2. 当历史 Tool/Human/AI 对话消息超出 `max_messages` 阈值时，自动保留最新的 `max_messages` 条消息。
    3. 插入提示说明，防止模型断层，优化 Token 开销。
    """
    if len(messages) <= max_messages:
        return messages

    # 1. 提取 SystemMessage 头部
    system_messages = [m for m in messages if isinstance(m, SystemMessage)]
    chat_messages = [m for m in messages if not isinstance(m, SystemMessage)]

    # 2. 如果对话消息超出限制，保留最新的 max_messages 条
    if len(chat_messages) > max_messages:
        trimmed_count = len(chat_messages) - max_messages
        trimmed_chat = chat_messages[-max_messages:]
        
        notice = SystemMessage(
            content=f"【上下文压缩提示】历史消息过多，系统已自动压缩并裁切早期 {trimmed_count} 条对话记录，以下为最新上下文。"
        )
        return system_messages + [notice] + trimmed_chat

    return messages
