from typing import TypedDict, List, Dict, Any, Tuple, Callable
from langchain_core.tools import tool

class TodoItem(TypedDict):
    content: str
    status: str  # "pending" | "in_progress" | "completed"

def create_todo_middleware() -> Tuple[list, Callable[[], List[Dict[str, Any]]]]:
    """
    创建 TODO 中间件。
    返回:
        (tools_list, get_todos_fn)
        - tools_list: 包含 write_todos 工具的列表
        - get_todos_fn: 无参函数，用于获取当前最新的结构化 TODOS 列表
    """
    todos_storage: List[Dict[str, Any]] = []

    @tool
    def write_todos(todos: List[dict]) -> str:
        """更新当前 Agent 任务的步骤拆解与执行进度列表。
        
        Args:
            todos: 任务字典列表，每个元素应包含 `content` (中文步骤描述) 和 `status` ("pending" | "in_progress" | "completed")。
            例如: [{"content": "搜索官方文档", "status": "completed"}, {"content": "整理报告并写入文件", "status": "in_progress"}]
        """
        nonlocal todos_storage
        todos_storage = todos
        
        formatted_lines = []
        for item in todos:
            status = item.get("status", "pending")
            content = item.get("content", "")
            icon = "✓" if status == "completed" else ("⏳" if status == "in_progress" else " ")
            formatted_lines.append(f"[{icon}] {content}")
        
        formatted = "\n".join(formatted_lines)
        return f"已成功更新 TODO 状态列表:\n{formatted}"

    def get_todos() -> List[Dict[str, Any]]:
        return todos_storage

    return [write_todos], get_todos
