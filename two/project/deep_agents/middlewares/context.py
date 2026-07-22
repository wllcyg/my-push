from typing import List
from langchain_core.messages import BaseMessage, SystemMessage

def trim_context_messages(
    messages: List[BaseMessage], 
    max_messages: int = 30
) -> List[BaseMessage]:
    """
    上下文自动裁剪与压缩中间件。
    """
    if len(messages) <= max_messages:
        return messages

    system_messages = [m for m in messages if isinstance(m, SystemMessage)]
    chat_messages = [m for m in messages if not isinstance(m, SystemMessage)]

    if len(chat_messages) > max_messages:
        trimmed_count = len(chat_messages) - max_messages
        trimmed_chat = chat_messages[-max_messages:]
        
        notice = SystemMessage(
            content=f"【上下文压缩提示】历史消息过多，系统已自动压缩并裁切早期 {trimmed_count} 条对话记录，以下为最新上下文。"
        )
        return system_messages + [notice] + trimmed_chat

    return messages
