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
from deep_agents_test.agent.skills_middleware import create_skills_prompt

# ==========================================
# 1. 准备沙箱与 Skill 模拟测试环境
# ==========================================
workspace_dir = Path(__file__).resolve().parent / "workspace-skills"
if workspace_dir.exists():
    shutil.rmtree(workspace_dir)

# 动态创建一个 Mock 技能: excalidraw-diagram-generator
skill_dir = workspace_dir / ".agents" / "skills" / "excalidraw-diagram-generator"
skill_dir.mkdir(parents=True, exist_ok=True)

skill_md_content = """---
name: excalidraw-diagram-generator
description: 专门用来生成符合 Excalidraw 规范的架构流程图 JSON 文件。
---
# Excalidraw 绘图指南 (SOP)

当你需要生成图表时，请严格遵守以下输出格式：

1. 文件必须为标准的 JSON 格式，且包含 "type": "excalidraw", "elements": [...]。
2. 每个节点元素必须包含 id, type, x, y, width, height, strokeColor, backgroundColor 等基础字段。
3. 如果生成成功，请保存到指定的文件路径中。
"""

(skill_dir / "SKILL.md").write_text(skill_md_content, encoding="utf-8")

# ==========================================
# 2. 运行 Python 版 Agent Skills 测试
# ==========================================
async def main():
    print("=== 开始运行 Python 版 Agent Skills 动态技能加载测试 ===")
    
    # 权限配置
    permissions = [
        {"operations": ["read", "write"], "paths": ["/*", "/**"], "mode": "allow"},
    ]
    fs_tools = create_filesystem_tools(root_dir=workspace_dir, permissions=permissions)

    base_prompt = "你是智能助手。工作区根路径为 /，可用 ls、read_file、write_file 操作文件。"
    
    # 一行代码注入技能库元数据！
    system_prompt = create_skills_prompt(
        base_prompt=base_prompt, 
        root_dir=workspace_dir, 
        skills_folder=".agents/skills"
    )
    
    print("\n生成的 System Prompt 包含的技能清单:\n", system_prompt)

    agent_graph = create_agent(default_model, tools=fs_tools, system_prompt=system_prompt)
    chat_agent = apply_middlewares(agent_graph)

    user_query = "请帮我画一张系统架构流程图，并保存为 /output/arch.excalidraw。"
    print(f"\n用户提问: {user_query}")
    
    reply = await chat_agent(user_query)
    print("\nAgent 最终回复:\n", reply)

if __name__ == "__main__":
    asyncio.run(main())
