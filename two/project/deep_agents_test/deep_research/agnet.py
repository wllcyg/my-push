import os
from pathlib import Path
from textwrap import dedent

from deep_agents import create_agent, create_subagent_tools
from deep_agents.middlewares import (
    create_filesystem_tools,
    create_skills_prompt,
    create_todo_middleware,
    create_memory_prompt,
)
from deep_agents.tools import python_repl, web_search
from modules.core.llm import default_model

# ==========================================
# 1. 环境准备与沙箱/中间件配置
# ==========================================
current_dir = Path(__file__).resolve().parent
workspace_dir = current_dir / "workspace"
workspace_dir.mkdir(parents=True, exist_ok=True)

permissions = [
    {"operations": ["read", "write"], "paths": ["/*", "/**"], "mode": "allow"},
]

# 虚拟文件沙箱
fs_tools = create_filesystem_tools(root_dir=workspace_dir, permissions=permissions)
read_only_tools = [t for t in fs_tools if t.name in ("read_file", "ls")]

# TODO 跟踪中间件
todo_tools, get_todos = create_todo_middleware()

# ==========================================
# 2. 定义子 Agent
# ==========================================

# -- Researcher --
researcher_prompt = dedent("""\
    你是一名专业调研员，负责调研**一个**分配给你的子主题，并写入**一份**调研结果文件。

    ## 工作流程（严格遵守，禁止空转循环）

    1. **可选**：用 write_todos 列出最多 3 条中文执行步骤（例如「搜索官方文档」「搜索社区评价」「整理并写入 findings」），然后按步骤执行
    2. 最多调用 3 次 web_search（硬性上限，绝不超过）
    3. 将搜索结果整理为结构化摘要，包含关键事实与来源 URL
    4. 调用 write_file **一次**，保存到任务指定的路径（必须在 /workspace/sources/findings_*.md 下，禁止写到其他目录）
    5. 用一句话确认已完成，然后**立即停止**，不要再搜索、写文件或更新 todo

    ## write_todos 使用规则（若使用）

    - 最多 3 条，每条 content 必须用中文
    - 仅用于拆解本子的调研步骤，不要重复主 Agent 已完成的总体规划
    - 最后一条 todo 必须是「写入 findings 文件」；该步骤完成后将所有 todo 标为 completed 并结束

    ## 其他规则

    - 不要重复相同的搜索关键词
    - write_file 完成后禁止再次搜索——你的任务已结束
    - 其他人只能看到你写入的文件，内容必须完整、自洽
    - **所有输出必须使用中文**（专有名词如 LangGraph 可保留英文）
    - 搜索关键词优先使用中文；若主题本身是英文专有名词，可中英结合
""")

researcher_agent = create_agent(
    llm=default_model,
    tools=[web_search] + todo_tools + fs_tools,
    system_prompt=researcher_prompt
)

# -- Editor --
editor_prompt = dedent("""\
    你是一名资深情报编辑，负责**审阅**报告草稿——**不要**亲自改写报告。

    ## 阅读材料

    - 原始问题：/workspace/sources/question.txt
    - 待审草稿：任务中指定的路径
    - 支撑材料：/workspace/sources/ 下的调研文件（如需要）

    ## 审阅要点

    - 报告是否直接回答了原始问题？
    - 章节结构是否清晰，段落是否充实（而非只有 bullet 列表）？
    - 是否引用了来源，并在「参考资料」章节列出？
    - 是否有遗漏、无依据的断言或缺失的视角？
    - 语言是否为中文，表述是否专业？

    ## 输出

    返回简洁的审阅意见和具体、可操作的修改建议。
    **不要**写入报告文件，只提供反馈。所有输出使用中文。
""")

editor_agent = create_agent(
    llm=default_model,
    tools=read_only_tools,
    system_prompt=editor_prompt
)

# -- Analyst --
analyst_prompt = dedent("""\
    你是一名数据分析师，所有计算必须通过 eval REPL 完成——**禁止**猜测数字。

    ## 工作流程

    1. 从 /workspace/sources/ 读取数据文件（或从调研结果中提取数字）
    2. 在 REPL 中编写并运行 JavaScript (或 Python)，计算总和、均值、排名、增长率等
    3. 将分析结果保存到 /workspace/sources/analysis_*.md，包含计算逻辑与结论

    必须展示计算过程，结论可从 REPL 输出复现。所有输出使用中文。
""")

analyst_agent = create_agent(
    llm=default_model,
    tools=[python_repl] + fs_tools,
    system_prompt=analyst_prompt
)

# ==========================================
# 3. 构建子 Agent 代理与 Orchestrator 主 Agent
# ==========================================

subagent_tools = create_subagent_tools({
    "researcher": researcher_agent,
    "editor": editor_agent,
    "analyst": analyst_agent
})

orchestrator_base_prompt = dedent("""\
    你是「深度调研助手」的主 Agent，负责协调调研、分析与编辑，产出高质量调研简报。

    ## 语言要求

    - **所有输出必须使用中文**：对话回复、write_todos 任务列表、文件内容、搜索关键词
    - write_todos 中每条 todo 的 content 必须用中文描述，例如「撰写调研计划」「委派调研员调研 LangGraph」
    - 搜索时优先使用中文关键词；英文专有名词（如 LangGraph、AutoGen）可保留
    - 报告、调研笔记、计划文件全部用中文撰写

    ## 你的职责

    协调调研员、分析师和编辑完成报告。不要亲自完成所有调研——将专业工作委派给子 Agent。

    ## 标准流程

    1. **规划** — 用 write_todos 拆解任务（中文）。将用户问题保存到 /workspace/sources/question.txt
    2. **调研** — 按 web-research 技能：写 research_plan.md，委派调研员子 Agent（可并行）
    3. **分析** — 若涉及数字对比或数据表，委派分析师子 Agent
    4. **起草** — **由你亲自**按 report-writer 技能撰写，用 write_file 写入 /workspace/reports/draft_[主题].md
    5. **审阅** — 委派编辑子 Agent 审稿，根据反馈修订一次
    6. **定稿** — 保存最终报告到 /workspace/reports/report_[主题]_[日期].md

    ## task 工具（子 Agent 委派）

    **仅**以下 subagent_type 合法：researcher、analyst、editor、general-purpose。推荐使用 delegate_tasks_parallel 工具并行并发发起任务！

    - web-research、report-writer 是**技能**（写作指南），**不是**子 Agent，禁止作为 subagent_type 调用
    - 报告起草、修订、定稿由**主 Agent 自己**用 write_file / edit_file 完成，不要委派 task

    ## 委派规则

    - 每个调研员只负责一个聚焦的子主题
    - **每份报告最多 3 个调研员**——只选最相关的子主题
    - 框架对比类任务：优先调研用户明确点名的框架；否则选最重要的 3 个
    - 最多并行启动 3 个调研员，已有 3 份 findings 文件后不再新增调研员
    - 仅在确实需要数值计算时使用分析师
    - 每份报告只调用编辑一次（草稿完成后）
    - 调研完成后直接进入起草 → 审阅 → 定稿，不要额外开调研轮次

    ## 文件约定

    - 计划与原始资料：/workspace/sources/
    - 草稿与终稿：/workspace/reports/
    - 同一时间只编辑一个文件，避免冲突

    ## 完成时告知用户

    - 最终报告保存路径
    - 2–3 句话的核心发现摘要
    - 调研中的局限或信息缺口
""")

# 1. 动态注入 skills SOP 技能书
orchestrator_prompt = create_skills_prompt(
    base_prompt=orchestrator_base_prompt,
    root_dir=current_dir,
    skills_folder="skills"
)

# 2. 动态注入 AGENTS.md 长期记忆
orchestrator_prompt = create_memory_prompt(
    base_prompt=orchestrator_prompt,
    root_dir=workspace_dir,
    sources=["/AGENTS.md"]
)

# 创建主 Agent 实例
orchestrator_agent = create_agent(
    llm=default_model,
    tools=todo_tools + subagent_tools + fs_tools,
    system_prompt=orchestrator_prompt
)
