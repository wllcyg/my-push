from modules.core.llm import default_model
from modules.config.settings import get_settings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel
from modules.ai.tools.get_user import get_user
from modules.ai.tools.send_mail import send_mail
from modules.ai.agent_runner import run_agent_loop, run_agent_loop_stream
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
class AiService:
    """
    Service 层：只负责核心业务逻辑。
    """
    def generate_reply(self, prompt: str) -> dict:
        settings = get_settings()
        app_name = settings.app_name

        # 1. 准备你想给大模型配备的工具列表（将发送邮件工具加进来，也可以随时加入 get_user）
        tools = [send_mail]
        
        # 2. 将工具绑定到大模型上
        model_with_tools = default_model.bind_tools(tools)
        
        # 3. 构造提示词模板。给大模型设定人设，告诉它如果有发邮件诉求就要调用工具
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个全能的 AI 助手。如果用户要求发送邮件，请根据上下文提取收件人、主题和内容，并使用发邮件工具完成任务。如果不需要发邮件，请正常详细回答问题。"),
            ("human", "{user_question}")
        ])
        messages = prompt_template.invoke({"user_question": prompt}).to_messages()

        # 4. 丢进咱们封装好的 agent runner 里，它会自动处理大模型到工具的循环调用
        final_response = run_agent_loop(
            model_with_tools=model_with_tools,
            tools=tools,
            messages=messages
        )

        return {
            "status": "success",
            "app_name": app_name,
            "prompt": prompt,
            "reply": final_response.content
        }

    def generate_reply_stream(self, prompt: str):
        """
        流式输出业务逻辑：使用 chain.stream() 获取生成器
        """
        prompt_template = PromptTemplate.from_template("请你作为一个专业的 AI 助手，详细回答以下问题：\n\n{user_question}")
        chain = prompt_template | default_model | StrOutputParser()
        
        # .stream() 返回的是一个生成器(Generator)，会一段一段地吐出文本
        return chain.stream({"user_question": prompt})

    def get_user(self, user_id: str) -> dict:
        # 1. 准备工具列表
        tools = [get_user]
        
        # 2. 将工具绑定到大模型上
        model_with_tools = default_model.bind_tools(tools)
        
   

        # 3. 使用 ChatPromptTemplate 进行标准的模板管理
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个权限管理员，擅长查询和分析用户信息。"),
            ("human", "请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。")
        ])
        
        # 把动态参数传给模板，并将其转换为消息数组 (List[BaseMessage])
        messages = prompt_template.invoke({"user_id": user_id}).to_messages()
        
        final_response = run_agent_loop(
            model_with_tools=model_with_tools,
            tools=tools,
            messages=messages
        )
        
        # 5. 此时 final_response.content 就是大模型在拿到工具数据后，最终组织好的人话
        return {
            "status": "success",
            "user_id": user_id,
            "content": final_response.content
        }

    async def get_user_stream(self, user_id: str):
        # 1. 准备工具列表
        tools = [get_user]
        
        # 2. 将工具绑定到大模型上
        model_with_tools = default_model.bind_tools(tools)
        
        # 3. 准备 Prompt
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "你是一个权限管理员，擅长查询和分析用户信息。"),
            ("human", "请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。")
        ])
        messages = prompt_template.invoke({"user_id": user_id}).to_messages()
        
        # 4. 调用流式的 agent runner
        return run_agent_loop_stream(
            model_with_tools=model_with_tools,
            tools=tools,
            messages=messages
        )