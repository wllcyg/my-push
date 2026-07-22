import os
from langchain_core.tools import tool

@tool
def read_file(filepath: str) -> str:
    """读取指定路径文件的内容。"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"读取文件失败: {str(e)}"

@tool
def write_file(filepath: str, content: str) -> str:
    """将内容写入指定路径的文件。如果目录不存在会自动创建。"""
    try:
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"文件已成功写入到 {filepath}"
    except Exception as e:
        return f"写入文件失败: {str(e)}"
