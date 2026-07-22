# 实战：构建 Deep Research 深度调研多智能体系统

本教程展示如何利用 `deep_agents` 框架，从零开始搭建一个具备“主 Agent 协调 + 3 个子 Agent（调研员、分析师、编辑）+ 虚拟沙箱 + 技能 SOP + 长期记忆”的生产级深度调研助手。

---

## 1. 业务架构分析

系统包含 4 个核心 Agent 角色：

```text
                  +--------------------------------+
                  |  主 Agent (Orchestrator)        |
                  |  - 规划 TODO                   |
                  |  - 读取技能 SOP                 |
                  |  - 自动读取/更新 AGENTS.md      |
                  +--------------------------------+
                                  |
     +----------------------------+----------------------------+
     | (delegate_tasks_parallel)  |                            |
     v                            v                            v
+------------------+    +------------------+    +------------------+
| 子 Agent:        |    | 子 Agent:        |    | 子 Agent:        |
| Researcher       |    | Analyst          |    | Editor           |
| - web_search     |    | - python_repl    |    | - read_only_tools|
| - write_file     |    | - write_file     |    | - 审查草稿        |
+------------------+    +------------------+    +------------------+
```

---

## 2. 完整实现代码

```python
import asyncio
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

# 1. 准备沙箱与中间件
current_dir = Path(__file__).resolve().parent
workspace_dir = current_dir / "workspace"
workspace_dir.mkdir(parents=True, exist_ok=True)

fs_tools = create_filesystem_tools(root_dir=workspace_dir)
read_only_tools = [t for t in fs_tools if t.name in ("read_file", "ls")]
todo_tools, get_todos = create_todo_middleware()

# 2. 构建子 Agent (Researcher, Editor, Analyst)
researcher_agent = create_agent(
    llm=default_model,
    tools=[web_search] + todo_tools + fs_tools,
    system_prompt="你是一名专业调研员，负责联网搜索并将结论保存到 /workspace/sources/findings_*.md。"
)

editor_agent = create_agent(
    llm=default_model,
    tools=read_only_tools,
    system_prompt="你是一名资深编辑，只读草稿并提出修改意见，不亲自写文件。"
)

analyst_agent = create_agent(
    llm=default_model,
    tools=[python_repl] + fs_tools,
    system_prompt="你是一名数据分析师，使用 python_repl 进行数据计算并将结果保存到 /workspace/sources/analysis_*.md。"
)

# 3. 产生子 Agent 高并发委派工具
subagent_tools = create_subagent_tools({
    "researcher": researcher_agent,
    "editor": editor_agent,
    "analyst": analyst_agent
})

# 4. 构建主 Agent (Orchestrator) 并注入 Skills & Memory
orchestrator_prompt = "你是深度调研助手的主 Agent..."

# 动态注入 SOP 技能
orchestrator_prompt = create_skills_prompt(
    base_prompt=orchestrator_prompt,
    root_dir=current_dir,
    skills_folder="skills"
)

# 动态注入 AGENTS.md 长期记忆
orchestrator_prompt = create_memory_prompt(
    base_prompt=orchestrator_prompt,
    root_dir=workspace_dir,
    sources=["/AGENTS.md"]
)

orchestrator_agent = create_agent(
    llm=default_model,
    tools=todo_tools + subagent_tools + fs_tools,
    system_prompt=orchestrator_prompt
)

# 5. 启动测试
async def run():
    res = await orchestrator_agent.ainvoke({
        "messages": [("human", "对比 LangGraph 与 AutoGen 架构，并撰写简报")]
    })
    print("Agent 回复:", res["messages"][-1].content)
    print("最新 TODOs:", get_todos())

if __name__ == "__main__":
    asyncio.run(run())
```

---

## 3. 框架最佳实践经验

1. **并行优先**：在主 Agent 的 System Prompt 中明确提醒“推荐优先使用 `delegate_tasks_parallel` 并行发起调研”，可将多路调研时间缩短 60%。
2. **沙箱隔离**：所有的读写统一使用 `fs_tools`，禁止直接使用标准 `open()` 文件操作。
3. **记忆闭包**：在运行主流程前后随时调用 `get_todos()`，可完美拿到可被 UI 前端直接渲染的结构化进度对象。
