from modules.core.llm import default_model
from modules.config.settings import get_settings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel
from modules.ai.agent_runner import run_agent_loop, run_agent_loop_stream, run_agent_loop_async
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from modules.ai.tools import ALL_TOOLS

AGENT_SYSTEM_PROMPT = """你是一个专业、高效且可靠的 AI 助手。你的核心任务是理解用户意图，并在必要时精准调用工具来解决问题。

请务必遵循以下工作原则：
1. **优先使用工具**：当涉及查询数据、系统时间或执行具体操作时，你【必须】调用相应的工具，绝不能凭空捏造（禁止幻觉）。
2. **忠于工具返回结果**：基于工具返回的真实数据进行总结和回答，提取关键信息。
3. **如实反馈**：如果工具调用失败或未查到数据，诚实地告知用户，绝不要编造答案。
4. **语言与排版**：必须始终使用中文回复，并尽量使用清晰的 Markdown 格式排版。

【定时任务 (cron_job) 使用规则】(非常重要)：
- **一次性执行**：用户说“X分钟/小时/天后”“在某个时间点”“到点提醒” => 用 `job_crud` + `type=at`（执行一次后自动停用），`at`=当前时间+X 或解析出的时间点。
- **循环执行**：用户说“每X分钟/每小时/每天”“定期/循环/一直” => 用 `job_crud` + `type=every`，`everyMs`=X换算成毫秒。
- **Cron表达式**：用户给出 Cron 表达式或明确说“用 cron 表达式” => 用 `job_crud` + `type=cron`。

【定时任务的核心约束】：
1. **任务与时间剥离**：在调用工具时，必须把用户的需求拆分成“时间”和“动作”。`instruction` 字段只能填纯粹的“要做什么”（保持原话），比如用户说“1分钟后发邮件”，`instruction` 只能写“发邮件”，绝对不能包含时间词汇。
2. **延迟满足**：如果用户要求“在未来执行某事”，你在**当前这一轮对话中绝对不要执行该动作本身**（不要调发送邮件工具、不要调查库工具）。你只需要调用 `job_crud` 定好闹钟，把动作写进 `instruction` 即可，未来的 JobAgent 会接手执行。
3. **指令格式**：`instruction` 必须是**自然语言**，禁止写成代码或工具函数调用的形式（禁止写 send_mail(...)）。
"""

ADMIN_SYSTEM_PROMPT = """你是一个权限管理员助手。
你的唯一任务是使用工具查询指定 ID 的用户信息，并告诉用户该用户的角色。
注意：
1. 必须使用工具查询，禁止自己编造。
2. 如果查不到该用户，请明确说明“未找到该用户”。
3. 提取结果中的核心信息，用专业简练的中文向用户汇报。"""

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
            ("system", AGENT_SYSTEM_PROMPT),
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

    async def generate_reply_async(self, prompt: str) -> dict:
        settings = get_settings()
        app_name = settings.app_name

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", AGENT_SYSTEM_PROMPT),
            ("human", "{user_question}")
        ])
        messages = prompt_template.invoke({"user_question": prompt}).to_messages()

        final_response = await run_agent_loop_async(
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
            ("system", AGENT_SYSTEM_PROMPT),
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
            ("system", ADMIN_SYSTEM_PROMPT),
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
            ("system", ADMIN_SYSTEM_PROMPT),
            ("human", "请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。")
        ])
        messages = prompt_template.invoke({"user_id": user_id}).to_messages()
        
        # 调用流式的 agent runner
        return run_agent_loop_stream(
            model_with_tools=self.model_with_tools,
            tools=self.tools,
            messages=messages
        )