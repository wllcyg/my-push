# DeepAgents 中间件完全手册
![image](https://api.cheatppf.xyz/i/2go5iathbl6-63drt6.png)
`deep_agents.middlewares` 包含了框架内置的 6 大独立插件化中间件。

导入路径：
```python
from deep_agents.middlewares import (
    create_filesystem_tools,
    create_skills_prompt,
    create_memory_prompt,
    create_todo_middleware,
    trim_context_messages,
    MultiAgentLoggingCallback,
    ExecutionTraceTracker
)
```

---

## 1. 虚拟文件沙箱 (`fs.py`)

生成带有**虚拟沙箱限制**与 **RBAC 权限白名单**的文件系统工具组。

### 签名
```python
def create_filesystem_tools(
    root_dir: str | Path, 
    permissions: list[dict] = None
) -> list[BaseTool]
```

### 返回工具
- `ls(virtual_path="/")`: 列出目录下的文件。
- `read_file(virtual_path)`: 读取文件内容。
- `write_file(virtual_path, content)`: 覆盖写入文件（自动创建父级目录）。
- `append_file(virtual_path, content)`: 追加写入文件末尾。
- `edit_file(virtual_path, old_string, new_string)`: 局部精准替换字符串。

### 示例与权限配置
```python
permissions = [
    {"operations": ["read"], "paths": ["/secret.txt"], "mode": "deny"},
    {"operations": ["write"], "paths": ["/workspace/*"], "mode": "allow"}
]

fs_tools = create_filesystem_tools(root_dir="./workspace", permissions=permissions)
```

---

## 2. SOP 技能库注入器 (`skills.py`)

动态解析技能目录中的 `SKILL.md`（带 YAML Frontmatter），将符合权限的技能列表注入 System Prompt。

### 签名
```python
def create_skills_prompt(
    base_prompt: str, 
    root_dir: str | Path, 
    skills_folder: str = ".agents/skills",
    agent_role: str = "all"
) -> str
```

### 示例
```python
# 自动扫描 ./skills/ 目录下的 SKILL.md 文件并格式化注入 Prompt
prompt = create_skills_prompt(
    base_prompt="你是深度调研助手。",
    root_dir=Path.cwd(),
    skills_folder="skills"
)
```

---

## 3. AGENTS.md 长期记忆持久化 (`memory.py`)

通用长期记忆注入器。动态读取 `sources` 中定义的 Markdown 记忆文件并注入 Prompt。

### 签名
```python
def create_memory_prompt(
    base_prompt: str, 
    root_dir: str | Path, 
    sources: list[str]
) -> str
```

### 示例
```python
prompt = create_memory_prompt(
    base_prompt=prompt,
    root_dir=workspace_dir,
    sources=["/AGENTS.md", "/memory/user_pref.md"]
)
```

---

## 4. 结构化 Task 跟踪器 (`todo.py`)

生成 `write_todos` 工具，并向应用层暴露可随时调用的结构化状态闭包。

### 签名
```python
def create_todo_middleware() -> Tuple[list[BaseTool], Callable[[], list[dict]]]
```

### 示例
```python
todo_tools, get_todos = create_todo_middleware()

# 1. 挂载 todo_tools 给 agent
agent = create_agent(llm, tools=todo_tools + fs_tools)

# 2. 运行后调用 get_todos() 拿结构化进度
await agent.ainvoke(...)
print(get_todos()) 
# 输出: [{'content': '搜索文档', 'status': 'completed'}, {'content': '起草报告', 'status': 'in_progress'}]
```

---

## 5. 防溢出上下文滑动裁切 (`context.py`)

自动截断历史 Message，保护头部 System Message（Prompt、技能书、记忆）不丢。

### 签名
```python
def trim_context_messages(messages: list[BaseMessage], max_messages: int = 30) -> list[BaseMessage]
```
已默认内置在 `create_agent` 工厂内部，无需手动配置。

---

## 6. 层级日志与 Trace 追踪器 (`logger.py`)

提供全链路结构化 Trace 事件抓取与控制台多 Agent 层级打印。

### 示例
```python
tracker = ExecutionTraceTracker()
cb = MultiAgentLoggingCallback(agent_name="Supervisor", is_subagent=False, tracker=tracker)

# 传入 callbacks
await agent.ainvoke(..., config={"callbacks": [cb]})

# 获取结构化 JSON Trace
print(tracker.to_json())
```
