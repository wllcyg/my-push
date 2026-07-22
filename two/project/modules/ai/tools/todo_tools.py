from langchain_core.tools import tool

@tool
def write_todos(todos: list[str]) -> str:
    """写入 TODO 列表，用于规划接下来的执行步骤。
    
    Args:
        todos: 待办事项列表的字符串数组，最多包含3个步骤。
    """
    formatted_todos = "\n".join([f"- {todo}" for todo in todos])
    return f"TODO 列表已记录:\n{formatted_todos}"
