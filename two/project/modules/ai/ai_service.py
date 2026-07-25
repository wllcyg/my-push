from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from langgraph.prebuilt import create_react_agent
from modules.core.llm import default_model
from modules.config.settings import get_settings
from modules.ai.tools import ALL_TOOLS
from modules.ai.session_service import SessionService
from langchain_core.messages import HumanMessage

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
    使用 LangGraph 内置的 create_react_agent 结合 SessionService 实现持久化与滑动窗口上下文。
    """
    def __init__(self):
        self.tools = ALL_TOOLS
        self.model = default_model
        
        # 使用 LangGraph 内置的 create_react_agent 封装通用 AI Agent 实例
        self.agent = create_react_agent(
            model=self.model,
            tools=self.tools,
            prompt=AGENT_SYSTEM_PROMPT
        )
        
        # 封装管理员权限 Agent 实例
        self.admin_agent = create_react_agent(
            model=self.model,
            tools=self.tools,
            prompt=ADMIN_SYSTEM_PROMPT
        )

    def generate_reply(self, prompt: str) -> dict:
        settings = get_settings()
        app_name = settings.app_name

        result = self.agent.invoke({"messages": [("human", prompt)]})
        final_message = result["messages"][-1]

        return {
            "status": "success",
            "app_name": app_name,
            "prompt": prompt,
            "reply": final_message.content
        }

    async def generate_reply_async(
        self, 
        prompt: str, 
        user_id: int = 1, 
        session_id: Optional[str] = None,
        db: Optional[AsyncSession] = None
    ) -> dict:
        settings = get_settings()
        app_name = settings.app_name

        current_session_id = session_id

        # 如果传入了 DB Session，开启完整的会话持久化与滑动窗口历史加载
        if db:
            session_svc = SessionService(db)
            session = await session_svc.get_or_create_session(session_id, user_id, app_name)
            current_session_id = session.id

            # 1. 持久化保存 User 消息
            await session_svc.save_message(current_session_id, "user", prompt)

            # 2. 读取包含当前消息的滑动窗口历史 (近 20 条)
            messages = await session_svc.get_history_messages(current_session_id, limit=20)
            
            # 3. 自动更新首句短标题
            await session_svc.update_session_title_if_needed(current_session_id, prompt)
        else:
            messages = [HumanMessage(content=prompt)]

        # 4. Agent 执行多轮上下文
        result = await self.agent.ainvoke({"messages": messages})
        final_message = result["messages"][-1]

        # 5. 持久化保存 Assistant 回复
        if db and current_session_id:
            await session_svc.save_message(current_session_id, "assistant", final_message.content)

        return {
            "status": "success",
            "app_name": app_name,
            "session_id": current_session_id,
            "prompt": prompt,
            "reply": final_message.content
        }

    async def generate_reply_stream(
        self, 
        prompt: str, 
        user_id: int = 1, 
        session_id: Optional[str] = None
    ):
        """
        流式输出业务逻辑：基于 LangGraph astream 机制，独立管理 DB 链接生命周期以支持 SSE 流式
        """
        from modules.core.database import AsyncSessionFactory

        current_session_id = session_id

        # 1. 提问开始前：使用独立 DB 会话落盘 User 消息与获取滑动窗口历史
        async with AsyncSessionFactory() as db:
            session_svc = SessionService(db)
            session = await session_svc.get_or_create_session(session_id, user_id)
            current_session_id = session.id

            await session_svc.save_message(current_session_id, "user", prompt)
            messages = await session_svc.get_history_messages(current_session_id, limit=20)
            await session_svc.update_session_title_if_needed(current_session_id, prompt)
            await db.commit()

        async def stream_generator():
            full_reply = []
            agent_stream = self.agent.astream(
                {"messages": messages},
                stream_mode="messages"
            )
            async for chunk, metadata in agent_stream:
                if metadata.get("langgraph_node") == "agent":
                    if chunk.content and isinstance(chunk.content, str):
                        full_reply.append(chunk.content)
                        yield chunk.content

            # 2. 流输出结束：再次使用独立 DB 会话落盘 Assistant 回复
            if current_session_id and full_reply:
                complete_text = "".join(full_reply)
                async with AsyncSessionFactory() as db:
                    session_svc = SessionService(db)
                    await session_svc.save_message(current_session_id, "assistant", complete_text)
                    await db.commit()

        return stream_generator(), current_session_id


    def get_user(self, user_id: str) -> dict:
        user_prompt = f"请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。"
        result = self.admin_agent.invoke({"messages": [("human", user_prompt)]})
        final_message = result["messages"][-1]
        
        return {
            "status": "success",
            "user_id": user_id,
            "content": final_message.content
        }

    async def get_user_stream(self, user_id: str):
        """
        流式查询用户信息：使用 admin_agent 的 astream 推送打字机流
        """
        user_prompt = f"请你帮我查询用户 ID 为 {user_id} 的信息，并告诉我该用户的角色。"
        
        async def stream_generator():
            agent_stream = self.admin_agent.astream(
                {"messages": [("human", user_prompt)]},
                stream_mode="messages"
            )
            async for chunk, metadata in agent_stream:
                if metadata.get("langgraph_node") == "agent":
                    if chunk.content and isinstance(chunk.content, str):
                        yield chunk.content

        return stream_generator()
