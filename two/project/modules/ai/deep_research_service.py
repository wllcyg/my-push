import os
import shutil
import json
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, Optional
from textwrap import dedent

from deep_agents import create_agent, create_subagent_tools
from deep_agents.middlewares import (
    create_filesystem_tools,
    create_skills_prompt,
    create_todo_middleware,
    create_memory_prompt,
)
from deep_agents.tools import python_repl, web_search
from modules.ai.tools.time_now import time_now
from modules.core.llm import default_model
from modules.core.supabase_storage import SupabaseStorageService


def build_isolated_orchestrator_agent(workspace_dir: Path):
    """
    动态构建 3-Agent 专职协同多智能体系统：
    1. time_agent (时间助手 -> time_now)
    2. search_agent (联网情报官 -> web_search)
    3. analyst_agent (数据分析师 -> python_repl)
    由 orchestrator 统一编排调度。
    """
    workspace_dir.mkdir(parents=True, exist_ok=True)
    sources_dir = workspace_dir / "sources"
    reports_dir = workspace_dir / "reports"
    sources_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    permissions = [
        {"operations": ["read", "write"], "paths": ["/*", "/**"], "mode": "allow"},
    ]

    fs_tools = create_filesystem_tools(root_dir=workspace_dir, permissions=permissions)
    todo_tools, get_todos = create_todo_middleware()

    # -- 1. Time Agent (专职时间助手) --
    time_prompt = dedent("""\
        你是一名专职时间助手。

        ## 职责
        当被调用时，必须优先调用 `time_now` 工具获取当前的精确日期与时间。
        用一句话清晰说明当前时间。所有输出使用中文。
    """)

    time_agent = create_agent(
        llm=default_model,
        tools=[time_now],
        system_prompt=time_prompt,
        default_recursion_limit=5
    )

    # -- 2. Search Agent (专职联网情报官) --
    search_prompt = dedent("""\
        你是一名专职网络情报官。

        ## 职责
        根据分配的子主题，最多调用 2 次 `web_search` 搜索网上的最新事实与数据。
        将结果整理为结构清晰的文本摘要并包含来源。所有输出使用中文。
    """)

    search_agent = create_agent(
        llm=default_model,
        tools=[web_search],
        system_prompt=search_prompt,
        default_recursion_limit=8
    )

    # -- 3. Analyst Agent (专职数据分析师) --
    analyst_prompt = dedent("""\
        你是一名专职数据分析师。

        ## 职责
        所有数值计算、比例或数据对比必须通过 `python_repl` 运行 Python 代码完成，严禁编造数字。
        返回包含代码计算逻辑与清晰结论的分析摘要。所有输出使用中文。
    """)

    analyst_agent = create_agent(
        llm=default_model,
        tools=[python_repl],
        system_prompt=analyst_prompt,
        default_recursion_limit=8
    )

    # 4. 注册 3 个专职 Agent
    subagent_tools = create_subagent_tools({
        "time_agent": time_agent,
        "search_agent": search_agent,
        "analyst_agent": analyst_agent
    }, default_timeout=120.0)

    # 5. 主 Orchestrator Agent 编排指令
    orchestrator_base_prompt = dedent("""\
        你是「多 Agent 智能协同工作流」的主调度官，负责协调专职 Agent 完成任务并实时汇报执行步骤。

        ## 语言要求
        - **所有输出必须使用中文**

        ## 标准多 Agent 协同工作流（请按顺序执行并播报步骤）：
        1. **⏰ [时间确认]**：委派 `time_agent` 获取最新系统时间与日期。
        2. **🔍 [情报检索]**：委派 `search_agent` 执行实时网络搜索，提取核心事实。
        3. **📊 [数据计算]**（如适用）：若任务涉及数据计算或对比，委派 `analyst_agent` 执行 Python 计算。
        4. **📝 [综合汇总]**：由你整合所有专职 Agent 的结果，使用 Markdown 格式整理一份排版精美、结构严谨的最终报告，并写入 `/workspace/reports/report_final.md`。

        ## 委派规则
        - 仅合法委派：`time_agent`、`search_agent`、`analyst_agent`
        - 在委派每一个 Agent 前后，用一句话简短播报当前阶段进度（例如：“⏰ [Time Agent] 正在获取系统时间...”，“🔍 [Search Agent] 正在检索信息...”）。
    """)

    current_dir = Path(__file__).resolve().parent.parent.parent / "deep_agents_test" / "deep_research"
    orchestrator_prompt = create_skills_prompt(
        base_prompt=orchestrator_base_prompt,
        root_dir=current_dir,
        skills_folder="skills"
    )

    orchestrator_prompt = create_memory_prompt(
        base_prompt=orchestrator_prompt,
        root_dir=workspace_dir,
        sources=["/AGENTS.md"]
    )

    orchestrator_agent = create_agent(
        llm=default_model,
        tools=todo_tools + subagent_tools + fs_tools,
        system_prompt=orchestrator_prompt,
        default_recursion_limit=25
    )

    return orchestrator_agent


class DeepResearchService:
    """3-Agent 专职协同工作流服务类"""

    def __init__(self, base_workspace_dir: Optional[Path] = None):
        if base_workspace_dir is None:
            self.base_workspace = Path(__file__).resolve().parent.parent.parent / "workspace_sessions"
        else:
            self.base_workspace = base_workspace_dir
        self.storage_service = SupabaseStorageService()

    async def run_stream(
        self, 
        prompt: str, 
        session_id: str
    ) -> AsyncGenerator[str, None]:
        """
        流式驱动 3-Agent 工作流，展现 Time Agent ➔ Search Agent ➔ Analyst Agent 的协同轨迹。
        """
        from modules.core.langfuse_handler import get_langfuse_callback

        session_workspace = self.base_workspace / session_id
        session_workspace.mkdir(parents=True, exist_ok=True)

        orchestrator = build_isolated_orchestrator_agent(session_workspace)

        # 关联 Langfuse 链路追踪 Callback
        langfuse_handler = get_langfuse_callback(
            session_id=session_id,
            trace_name="MultiAgentWorkflow",
            tags=["multi-agent-workflow", "3-agents"]
        )
        callbacks = [langfuse_handler] if langfuse_handler else []

        input_messages = {"messages": [("user", prompt)]}
        config = {
            "recursion_limit": 25,
            "callbacks": callbacks,
            "metadata": {
                "session_id": session_id
            }
        }

        last_report_content = ""
        final_report_text = ""
        final_public_url = None

        # 0. 瞬间发送开场白播报，确保前端 SSE 连接建立即有文字显示（避免静默与误切断）
        yield "🚀 **多 Agent 协同工作流已启动**，正在分析任务并为您调度专职 Agent...\n\n"

        try:
            # 监听事件流并推送打字机流
            async for event in orchestrator.astream_events(input_messages, version="v2", config=config):
                kind = event.get("event")
                name = event.get("name", "")
                data_field = event.get("data", {})

                # A. 大模型流式输出（仅保留主 Orchestrator Agent 的打字机流，过滤子 Agent 内部的流）
                if kind == "on_chat_model_stream":
                    metadata = event.get("metadata", {})
                    checkpoint_ns = metadata.get("checkpoint_ns", "")

                    if not checkpoint_ns:
                        chunk = data_field.get("chunk", None)
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            text_delta = str(chunk.content)
                            if text_delta:
                                yield text_delta

                # B. 工具调用开始通知（将工具调用、子 Agent 启动实时播报推送给前端）
                elif kind == "on_tool_start":
                    tool_input = data_field.get("input", {})
                    if name == "task":
                        subagent_type = tool_input.get("subagent_type", tool_input.get("description", "general"))
                        description = tool_input.get("description", "")
                        if "time" in subagent_type.lower():
                            yield "\n\n⏰ **[Time Agent 启动]** 正在获取系统的当前时间...\n\n"
                        elif "search" in subagent_type.lower():
                            yield "\n\n🔍 **[Search Agent 启动]** 正在检索最新网络情报与背景信息...\n\n"
                        elif "analyst" in subagent_type.lower():
                            yield "\n\n📊 **[Analyst Agent 启动]** 正在运行 Python 代码执行数据计算与分析...\n\n"
                        else:
                            yield f"\n\n⚙️ **[专职 Agent 启动: {subagent_type}]** {description}...\n\n"
                    elif name == "web_search":
                        query = tool_input.get("query", "")
                        yield f"🌐 *执行网络搜索: 「{query}」...*\n"
                    elif name == "python_repl":
                        yield "🧮 *运行 Python REPL 执行代码计算...*\n"
                    elif name == "time_now":
                        yield "⏰ *查询当前系统时间...*\n"

                # C. 监测最终报告写入
                elif kind == "on_tool_end":
                    if name in ("write_file", "edit_file"):
                        reports_dir = session_workspace / "reports"
                        if reports_dir.exists():
                            report_files = list(reports_dir.glob("*.md"))
                            if report_files:
                                try:
                                    latest_file = max(report_files, key=lambda f: f.stat().st_mtime)
                                    report_content = latest_file.read_text(encoding="utf-8")
                                    if report_content and report_content != last_report_content:
                                        last_report_content = report_content
                                        final_report_text = report_content
                                except Exception as e:
                                    print(f"⚠️ [DeepResearchService] 读取报告更新失败: {e}")

        except Exception as e:
            print(f"❌ [DeepResearchService] 多 Agent 执行发生错误: {e}")
            yield f"\n\n⚠️ [错误] 多 Agent 工作流执行过程发生异常: {str(e)}"
        
        # 上传至 Supabase 对象存储
        reports_dir = session_workspace / "reports"
        final_file_path = None
        if reports_dir.exists():
            report_files = list(reports_dir.glob("*.md"))
            if report_files:
                final_file_path = max(report_files, key=lambda f: f.stat().st_mtime)
                if not final_report_text:
                    final_report_text = final_file_path.read_text(encoding="utf-8")

        if final_file_path and final_file_path.exists():
            remote_path = f"reports/{session_id}/{final_file_path.name}"
            print(f"☁️ [DeepResearchService] 正在将最终报告上传至 Supabase: {remote_path}")
            public_url = self.storage_service.upload_file(final_file_path, remote_path)
            if public_url:
                final_public_url = public_url
                print(f"✅ [DeepResearchService] 上传 Supabase 成功: {public_url}")

        if final_public_url:
            url_footer = f"\n\n---\n> ☁️ **云端存储归档**：[下载/查看 Supabase 原始报告 Markdown]({final_public_url})\n"
            yield url_footer

        # 清理本地临时沙箱
        try:
            if session_workspace.exists():
                shutil.rmtree(session_workspace, ignore_errors=True)
                print(f"🧹 [DeepResearchService] 成功清理本地临时沙箱目录: {session_workspace}")
        except Exception as e:
            print(f"⚠️ [DeepResearchService] 清理沙箱目录异常: {e}")

        # 手动刷盘同步至 Langfuse
        if langfuse_handler:
            try:
                if hasattr(langfuse_handler, "flush"):
                    langfuse_handler.flush()
                elif hasattr(langfuse_handler, "langfuse") and hasattr(langfuse_handler.langfuse, "flush"):
                    langfuse_handler.langfuse.flush()
                print(f"📊 [DeepResearchService] 成功同步 Trace 数据至 Langfuse 面板 (Session: {session_id})")
            except Exception as e:
                print(f"⚠️ [DeepResearchService] Langfuse 刷盘异常: {e}")
