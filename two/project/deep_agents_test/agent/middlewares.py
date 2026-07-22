from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import SystemMessage, HumanMessage
from typing import Callable, Any

# 中间件

class LoggingCallback(BaseCallbackHandler):
    def __init__(self):
        self.call_count = 0

    def on_chat_model_start(self, serialized, messages, **kwargs):
        self.call_count += 1
        print(f"\n[Logging] 模型准备生成，当前消息数: {len(messages[0])}，已调用: {self.call_count} 次")

    def on_chat_model_end(self, response, **kwargs):
        content = response.generations[0][0].text[:80]
        print(f"[Logging] 模型返回: {content}...")

    def on_tool_start(self, serialized, input_str, **kwargs):
        print(f"[Logging] 正在调用工具，参数: {input_str}")


def apply_middlewares(graph_app)->Callable[[str], Any]:

    logger = LoggingCallback()
    async def wrapped_invoke(user_text):

        if 'BLOCKED' in user_text:
            return '系统拦截到了敏感词'

        injected_messages = [
            SystemMessage(content='额外指令:请用一句话简介回答'),
            HumanMessage(content=user_text)
        ]

        response_state = await graph_app.ainvoke(
            {'messages': injected_messages},
            config={'callbacks': [logger]}
        )
        return response_state['messages'][-1].content
    return wrapped_invoke