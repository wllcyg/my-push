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

# ==========================================
# 1. 准备本地工作区沙箱目录 (workspace)
# ==========================================
workspace_dir = Path(__file__).resolve().parent / "workspace"
if workspace_dir.exists():
    shutil.rmtree(workspace_dir)
workspace_dir.mkdir(parents=True, exist_ok=True)

# 创建绝密文件
(workspace_dir / "secret.txt").write_text("机密：不得读取", encoding="utf-8")

# ==========================================
# 2. 定义权限规则配置 (与 TS 版本完全 1:1 对齐的 RBAC 格式)
# ==========================================
permissions = [
    {"operations": ["read"], "paths": ["/secret.txt"], "mode": "deny"},
    {"operations": ["write"], "paths": ["/todo.md"], "mode": "allow"},
    {"operations": ["write"], "paths": ["/*"], "mode": "deny"},
]

# ==========================================
# 3. 测试场景
# ==========================================
async def main():
    print(f"工作区物理路径: {workspace_dir}")
    print("已初始化物理文件 /secret.txt")
    print("已应用 RBAC 规则:", permissions)
    
    # 核心：使用我们在 fs_middleware.py 里封装的函数，一行代码生成安全工具集！
    fs_tools = create_filesystem_tools(root_dir=workspace_dir, permissions=permissions)
    
    agent_graph = create_agent(
        default_model, 
        tools=fs_tools, 
        system_prompt="工作区根路径为 /。请使用 ls、read_file、write_file 操作文件，路径以 / 开头。用中文回答。"
    )
    chat_agent = apply_middlewares(agent_graph)
    
    print("\n--- 测试 1: 允许的操作 (创建 /todo.md) ---")
    reply1 = await chat_agent("请使用 write_file 创建 /todo.md，写入三条待办事项，然后用 ls / 查看。")
    print("Agent 回复:", reply1)
    
    print("\n--- 测试 2: 禁止的操作 (尝试读取 /secret.txt) ---")
    reply2 = await chat_agent("请使用 read_file 读取 /secret.txt 的内容。")
    print("Agent 回复:", reply2)
    
    print("\n--- 测试 3: 禁止的操作 (尝试写入 /hack.txt) ---")
    reply3 = await chat_agent("请使用 write_file 在 /hack.txt 写入 test。")
    print("Agent 回复:", reply3)

if __name__ == "__main__":
    asyncio.run(main())
