import asyncio
import shutil
from pathlib import Path
from dotenv import load_dotenv

# 0. 加载环境变量
root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(root_dir / ".env")

from modules.core.llm import default_model
from deep_agents_test.agent.react_agent import create_agent
from deep_agents_test.agent.middlewares import apply_middlewares
from deep_agents_test.agent.fs_middleware import create_filesystem_tools
from deep_agents_test.agent.memory_middleware import create_memory_prompt

# ==========================================
# 1. 准备记忆存储的工作区
# ==========================================
workspace_dir = Path(__file__).resolve().parent / "workspace-memory"
if workspace_dir.exists():
    shutil.rmtree(workspace_dir)
workspace_dir.mkdir(parents=True, exist_ok=True)
(workspace_dir / "memory").mkdir(exist_ok=True)

# 初始两个记忆文件
project_memory_path = workspace_dir / "AGENTS.md"
preferences_memory_path = workspace_dir / "memory" / "preferences.md"

project_memory_path.write_text("# 项目记忆\n- 本项目是一个基于 LangGraph 的 AI Agent 测试框架。\n", encoding="utf-8")
preferences_memory_path.write_text("# 个人偏好记忆\n", encoding="utf-8")

# 记忆源文件配置 (与 TS 版本的 sources 参数完全一致)
memory_sources = ["/AGENTS.md", "/memory/preferences.md"]

# ==========================================
# 2. 运行测试
# ==========================================
async def main():
    permissions = [
        {"operations": ["read", "write"], "paths": ["/AGENTS.md", "/memory", "/memory/*"], "mode": "allow"},
    ]
    fs_tools = create_filesystem_tools(root_dir=workspace_dir, permissions=permissions)

    prompts = [
        "根据记忆，这个项目是做什么的？只答一句。",
        "请记住：我常用的包管理器是 pnpm。",
        "请记住：本仓库主入口脚本是 src/deepagents/memory-agent.mjs。",
        "我常用什么包管理器？本 demo 主入口脚本路径是什么？各用一行回答。"
    ]

    base_prompt = "你是项目助手。工作区根路径为 /，可用 ls、read_file、write_file、append_file、edit_file 操作文件。当需要添加新记忆时，请优先使用 append_file 追加记录，切勿误覆盖原有文件！"

    for prompt in prompts:
        print(f"\n用户: {prompt}")
        
        # 核心：直接调用封装好的 create_memory_prompt 工厂函数！
        current_system_prompt = create_memory_prompt(
            base_prompt=base_prompt, 
            root_dir=workspace_dir, 
            sources=memory_sources
        )
        
        agent_graph = create_agent(default_model, tools=fs_tools, system_prompt=current_system_prompt)
        chat_agent = apply_middlewares(agent_graph)
        
        reply = await chat_agent(prompt)
        print("回复:", reply)

    print("\n" + "="*40)
    print("--- 最终磁盘上的 /AGENTS.md 内容 ---")
    print(project_memory_path.read_text(encoding="utf-8"))
    print("--- 最终磁盘上的 /memory/preferences.md 内容 ---")
    print(preferences_memory_path.read_text(encoding="utf-8"))

if __name__ == "__main__":
    asyncio.run(main())
