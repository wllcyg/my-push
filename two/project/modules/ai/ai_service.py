import asyncio
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from langgraph.prebuilt import create_react_agent
from modules.core.llm import default_model
from modules.config.settings import get_settings
from modules.ai.tools import ALL_TOOLS
from modules.ai.session_service import SessionService
from langchain_core.messages import HumanMessage, SystemMessage
from mem0_agent.service import memory_service
from pydantic import BaseModel, Field
from typing import Literal

async def _load_mem0_context(user_id: int, session_id: Optional[str], prompt: str) -> Optional[SystemMessage]:
    """
    并发查询 Mem0 用户长期记忆与会话短期记忆，拼装为 SystemMessage 动态注入 Prompt
    """
    try:
        user_str = str(user_id)
        tasks = [memory_service.search_async(query=prompt, user_id=user_str, limit=5)]
        if session_id:
            tasks.append(memory_service.search_async(query=prompt, user_id=user_str, run_id=session_id, limit=5))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        user_mems = results[0] if isinstance(results[0], list) else []
        session_mems = results[1] if len(results) > 1 and isinstance(results[1], list) else []

        blocks = []
        user_items = [f"- {m.get('memory')}" for m in user_mems if isinstance(m, dict) and m.get("memory")]
        session_items = [f"- {m.get('memory')}" for m in session_mems if isinstance(m, dict) and m.get("memory")]

        if user_items:
            blocks.append("【用户长期记忆】\n" + "\n".join(user_items))
        if session_items:
            blocks.append("【当前会话记忆】\n" + "\n".join(session_items))

        if not blocks:
            return None

        return SystemMessage(content="\n\n".join(blocks) + "\n\n请结合以上记忆回答，勿编造。")
    except Exception as e:
        print(f"⚠️ [AiService] Mem0 记忆加载异常 (自动降级忽略): {e}")
        return None

async def _async_persist_mem0(user_id: int, session_id: Optional[str], prompt: str, reply: str):
    """
    后台任务：异步将本轮对话写入 Mem0，不阻塞主响应链路
    """
    try:
        user_str = str(user_id)
        messages = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": reply}
        ]
        await memory_service.add_async(messages=messages, user_id=user_str, run_id=session_id)
        print(f"🧠 [AiService] 成功将本轮对话同步至 Mem0 (user_id={user_id})")
    except Exception as e:
        print(f"⚠️ [AiService] Mem0 记忆持久化异常 (非阻塞): {e}")

AGENT_SYSTEM_PROMPT = """你是一个全能且高效的企业级 AI 智能助手。你运行在统一混合交互入口中，具备知识检索、数据查询、定时任务调度及业务工具调用的综合能力。

请严格遵循以下核心工作规范：

1. **精准工具调用 (Tool-First)**：
   - 当用户请求涉及数据查询、系统时间获取或特定业务操作时，【必须】优先调用对应的工具执行，绝不编造虚拟数据（零幻觉）。
   - 忠于工具返回的真实数据进行提炼与总结，避免无依据的过度推论。

2. **定时任务调度约束 (Task Scheduling Rules)**：
   - **时间与动作剥离**：调用定时任务工具 (`job_crud`) 时，必须将“触发时间”与“具体动作”分离。`instruction` 参数仅能包含纯粹的自然语言操作动作（如：“发送数据统计邮件”），严禁包含时间修饰词。
   - **延迟执行原则**：针对未来的定时/延迟任务，在当前对话中仅需创建定时闹钟 (`job_crud`)，切勿在当前轮次提前执行该动作本身。

3. **回答排版与交互**：
   - 始终使用中文回复，采用结构清晰的 Markdown 格式（表格、列表、代码块）进行排版，提供专业、严谨且易读的回答。
"""

ADMIN_SYSTEM_PROMPT = """你是一个专业高效的系统权限与用户管理助手。

请严格遵循以下工作规范：
1. **真实查询**：必须通过调用工具获取指定 ID 的用户信息与角色权限，严禁主观推测或编造。
2. **如实反馈**：若查无此用户，请明确说明“未找到该用户”。
3. **信息提炼**：对查询结果进行核心信息提炼，以简练、专业的中文向管理员汇报。
"""


class IntentClassificationSchema(BaseModel):
    intent: Literal["LONG_TASK", "GENERAL_CHAT"] = Field(
        description="分类意图：LONG_TASK (长耗时复杂任务：如生成长文、深度研究报告、大篇幅代码/提纲)；GENERAL_CHAT (常规短对话/简单问答/基础查询)"
    )
    reason: str = Field(description="分类原因")

class AiService:
    """
    Service 层：只负责核心业务逻辑。
    使用 LangGraph 内置的 create_react_agent 结合 SessionService 实现持久化与滑动窗口上下文，
    集成 Mem0 记忆服务实现跨会话长期记忆与短期检索，
    并包含意图识别节点 (detect_intent) 实现长短任务的智能路由。
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

    async def detect_intent(self, prompt: str) -> Dict[str, Any]:
        """
        节点：意图识别 (Intent Recognition Node)
        判断用户提问是【长耗时复杂任务 LONG_TASK】还是【常规短问答 GENERAL_CHAT】
        """
        # 规则快速拦截（长文本或特定长文关键词）
        long_keywords = ["长文", "报告", "总结提纲", "深度方案", "撰写论文", "批量数据"]
        if len(prompt) > 250 or any(kw in prompt for kw in long_keywords):
            return {"intent": "LONG_TASK", "reason": "触发长任务规则关键词或文本字数较长"}

        try:
            structured_llm = self.model.with_structured_output(IntentClassificationSchema)
            classification_prompt = (
                "你是一个严格的意图分类助手。请严格按照以下标准分类用户请求：\n"
                "- GENERAL_CHAT：打招呼、简单概念解释、普通对话、问答、简单代码解答。（优先默认分类）\n"
                "- LONG_TASK：明确要求生成千字长文、长篇分析报告、深度论文提纲、长篇架构方案等耗时任务。\n\n"
                f"用户请求：'{prompt}'"
            )
            res = await structured_llm.ainvoke(classification_prompt)
            return {"intent": res.intent if res else "GENERAL_CHAT", "reason": res.reason if res else "默认归类"}
        except Exception as e:
            print(f"⚠️ [AiService] 意图识别节点调用异常 (降级为 GENERAL_CHAT): {e}")
            return {"intent": "GENERAL_CHAT", "reason": "调用降级"}

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
        db: Optional[AsyncSession] = None,
        auto_route_async: bool = True
    ) -> dict:
        settings = get_settings()
        app_name = settings.app_name

        current_session_id = session_id

        # 1. 节点：意图识别与分流 (仅非 Worker 内部调用时触发 auto_route_async)
        if auto_route_async:
            intent_res = await self.detect_intent(prompt)
            print(f"🎯 [AiService][意图识别节点] 分类: {intent_res['intent']}, 原因: {intent_res['reason']}")
            
            # 如果识别为 LONG_TASK，自动解耦压入 CloudAMQP 消息队列
            if intent_res["intent"] == "LONG_TASK":
                from modules.job.celery_app import generate_ai_report_task
                async_res = generate_ai_report_task.delay(prompt=prompt, user_id=user_id, session_id=session_id)
                return {
                    "status": "accepted",
                    "is_async": True,
                    "intent": "LONG_TASK",
                    "task_id": async_res.id,
                    "prompt": prompt,
                    "reply": f"系统已智能识别本请求为【长耗时任务】，已自动投递至 CloudAMQP 消息队列进行后台异步处理。Task ID: {async_res.id}"
                }

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

        # 4. 检索 Mem0 长期与会话记忆，若存在则在头部注入 SystemMessage
        mem0_sys_msg = await _load_mem0_context(user_id, current_session_id, prompt)
        invoke_messages = ([mem0_sys_msg] + messages) if mem0_sys_msg else messages

        # 5. Agent 执行多轮上下文
        result = await self.agent.ainvoke({"messages": invoke_messages})
        final_message = result["messages"][-1]

        # 6. 持久化保存 Assistant 回复
        if db and current_session_id:
            await session_svc.save_message(current_session_id, "assistant", final_message.content)

        # 7. 异步非阻塞写入 Mem0 长期记忆库
        asyncio.create_task(_async_persist_mem0(user_id, current_session_id, prompt, final_message.content))

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
        极速响应流式接口：在 10ms 内返回 EventSourceResponse，将意图识别与数据库操作全部移入生成器内部异步处理。
        """
        from modules.core.database import AsyncSessionFactory
        from modules.ai.deep_research_service import DeepResearchService
        from modules.core.langfuse_handler import get_langfuse_callback

        current_session_id = session_id or f"session_{user_id}_{int(asyncio.get_event_loop().time()*1000)}"

        async def stream_generator():
            full_reply = []
            active_session_id = current_session_id

            # 1. 在生成器内部落盘 User 消息与获取历史
            try:
                async with AsyncSessionFactory() as db:
                    session_svc = SessionService(db)
                    session = await session_svc.get_or_create_session(session_id, user_id)
                    active_session_id = session.id

                    await session_svc.save_message(active_session_id, "user", prompt)
                    messages = await session_svc.get_history_messages(active_session_id, limit=20)
                    await session_svc.update_session_title_if_needed(active_session_id, prompt)
                    await db.commit()
            except Exception as e:
                print(f"⚠️ [AiService] 数据库会话预处理异常 (降级运行): {e}")
                messages = [HumanMessage(content=prompt)]

            # 2. 生成器内部异步做意图识别分流
            intent_res = await self.detect_intent(prompt)
            print(f"🎯 [AiService][Stream 意图分流] 判定结果: {intent_res['intent']}, 原因: {intent_res['reason']}")

            # 3. 检索 Mem0 长期记忆
            mem0_sys_msg = await _load_mem0_context(user_id, active_session_id, prompt)
            invoke_messages = ([mem0_sys_msg] + messages) if mem0_sys_msg else messages

            # 4. 初始化 Langfuse 链路追踪
            langfuse_handler = get_langfuse_callback(
                session_id=active_session_id,
                user_id=str(user_id),
                trace_name="GeneralChat",
                tags=["general-chat"]
            )
            callbacks = [langfuse_handler] if langfuse_handler else []

            # 5. 执行多 Agent 或单 Agent 流程
            if intent_res["intent"] == "LONG_TASK":
                print(f"🚀 [AiService] 激活【Deep Research 深度调研多 Agent 引擎】(Session ID: {active_session_id})")
                deep_service = DeepResearchService()
                async for chunk in deep_service.run_stream(prompt=prompt, session_id=active_session_id):
                    if chunk:
                        full_reply.append(chunk)
                        yield chunk
            else:
                agent_stream = self.agent.astream(
                    {"messages": invoke_messages},
                    config={
                        "callbacks": callbacks,
                        "metadata": {
                            "session_id": active_session_id,
                            "user_id": str(user_id)
                        }
                    },
                    stream_mode="messages"
                )
                async for chunk, metadata in agent_stream:
                    if metadata.get("langgraph_node") == "agent":
                        if chunk.content and isinstance(chunk.content, str):
                            full_reply.append(chunk.content)
                            yield chunk.content

            # 6. 流输出结束：落盘 Assistant 回复与同步 Mem0 记忆
            if active_session_id and full_reply:
                complete_text = "".join(full_reply)
                try:
                    async with AsyncSessionFactory() as db:
                        session_svc = SessionService(db)
                        await session_svc.save_message(active_session_id, "assistant", complete_text)
                        await db.commit()
                except Exception as e:
                    print(f"⚠️ [AiService] 数据库落盘 Assistant 回复异常: {e}")
                
                asyncio.create_task(_async_persist_mem0(user_id, active_session_id, prompt, complete_text))

            # 7. Langfuse 同步
            if langfuse_handler:
                try:
                    if hasattr(langfuse_handler, "flush"):
                        langfuse_handler.flush()
                    elif hasattr(langfuse_handler, "langfuse") and hasattr(langfuse_handler.langfuse, "flush"):
                        langfuse_handler.langfuse.flush()
                except Exception:
                    pass

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

