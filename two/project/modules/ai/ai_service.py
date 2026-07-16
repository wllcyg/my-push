from modules.core.llm import default_model
from modules.config.settings import get_settings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel
from modules.ai.agent_runner import run_agent_loop, run_agent_loop_stream
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from modules.ai.tools import ALL_TOOLS
class AiService:
    """
    Service 层：只负责核心业务逻辑。
    """
    def __init__(self):
        self.tools = ALL_TOOLS
        self.model_with_tools = default_model.bind_tools(self.tools)

    def generate_reply(self, prompt: str) -> dict:
        settings = get_settings()
        app_name = settings.app_name

        # 构造提示词模板。给大模型设定人设，告诉它如果有特定诉求就要调用对应的工具
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个全能的 AI 助手。请根据上下文分析用户的诉求，并选择合适的工具来完成任务。如果不需要使用工具，请正常详细回答问题。"),
            ("human", "{user_question}")
        ])
        messages = prompt_template.invoke({"user_question": prompt}).to_messages()

        # 丢进咱们封装好的 agent runner 里，它会自动处理大模型到工具的循环调用
        final_response = run_agent_loop(
            model_with_tools=self.model_with_tools,
            tools=self.tools,
            messages=messages
        )

        return {
            "status": "success",
            "app_name": app_name,
            "prompt": prompt,
            "reply": final_response.content
        }

    async def generate_reply_stream(self, prompt: str):
        """
        流式输出业务逻辑：使用封装好的 run_agent_loop_stream 支持工具调用
        """
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个全能的 AI 助手。请根据上下文分析用户的诉求，并选择合适的工具来完成任务。如果不需要使用工具，请正常详细回答问题。"),
            ("human", "{user_question}")
        ])
        messages = prompt_template.invoke({"user_question": prompt}).to_messages()
        
        return run_agent_loop_stream(
            model_with_tools=self.model_with_tools,
            tools=self.tools,
            messages=messages
        )

    def get_user(self, user_id: str) -> dict:
        # 使用 ChatPromptTemplate 进行标准的模板管理
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个权限管理员，擅长查询和分析用户信息。"),
            ("human", "请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。")
        ])
        
        # 把动态参数传给模板，并将其转换为消息数组 (List[BaseMessage])
        messages = prompt_template.invoke({"user_id": user_id}).to_messages()
        
        final_response = run_agent_loop(
            model_with_tools=self.model_with_tools,
            tools=self.tools,
            messages=messages
        )
        
        # 5. 此时 final_response.content 就是大模型在拿到工具数据后，最终组织好的人话
        return {
            "status": "success",
            "user_id": user_id,
            "content": final_response.content
        }

    async def get_user_stream(self, user_id: str):
        # 准备 Prompt
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个权限管理员，擅长查询和分析用户信息。"),
            ("human", "请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。")
        ])
        messages = prompt_template.invoke({"user_id": user_id}).to_messages()
        
        # 调用流式的 agent runner
        return run_agent_loop_stream(
            model_with_tools=self.model_with_tools,
            tools=self.tools,
            messages=messages
        )