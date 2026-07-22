# fs_middleware.py (我们自己封装的通用库)
import fnmatch
from pathlib import Path
from langchain_core.tools import tool

def create_filesystem_tools(root_dir: str | Path, permissions: list[dict] = None):
    """
    一行代码生成自带【虚拟沙箱】与【RBAC 权限策略】的文件工具集！
    """
    root_path = Path(root_dir).resolve()
    permissions = permissions or []

    def check_permission(op: str, vpath: str) -> bool:
        for rule in permissions:
            if op in rule.get("operations", []) and any(fnmatch.fnmatch(vpath, p) for p in rule.get("paths", [])):
                return rule.get("mode") == "allow"
        return True

    def get_real_path(vpath: str) -> Path:
        real = (root_path / vpath.lstrip("/")).resolve()
        if not str(real).startswith(str(root_path)):
            raise PermissionError("非法路径穿越")
        return real

    @tool
    def read_file(virtual_path: str) -> str:
        """读取文件内容，路径如 /secret.txt。注意：请勿传入文件夹路径。"""
        if not check_permission("read", virtual_path):
            return f"【权限拒绝】禁止读取文件: {virtual_path}"
        try:
            p = get_real_path(virtual_path)
            if not p.exists():
                return "文件不存在"
            if p.is_dir():
                return f"错误: {virtual_path} 是一个目录，请使用 ls 命令查看目录内容。"
            return p.read_text(encoding="utf-8")
        except Exception as e:
            return f"读取出错: {str(e)}"

    @tool
    def write_file(virtual_path: str, content: str) -> str:
        """写入文件，路径如 /todo.md。注意：不能直接写入目录。"""
        if not check_permission("write", virtual_path):
            return f"【权限拒绝】禁止写入文件: {virtual_path}"
        try:
            p = get_real_path(virtual_path)
            if p.is_dir():
                return f"错误: {virtual_path} 是一个目录，无法直接写入文件。"
            # 自动创建父级目录（如果不存在）
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
            return f"成功写入文件: {virtual_path}"
        except Exception as e:
            return f"写入出错: {str(e)}"

    @tool
    def ls(virtual_path: str = "/") -> str:
        """列出目录下的文件列表"""
        try:
            p = get_real_path(virtual_path)
            if not p.exists():
                return "目录不存在"
            if not p.is_dir():
                return f"错误: {virtual_path} 是一个文件而不是目录。"
            return f"文件列表: {[f.name for f in p.iterdir()]}"
        except Exception as e:
            return f"列出失败: {str(e)}"

    @tool
    def append_file(virtual_path: str, content: str) -> str:
        """向指定文件的末尾追加新内容（非常适用于追加记忆）。"""
        if not check_permission("write", virtual_path):
            return f"【权限拒绝】禁止追加文件: {virtual_path}"
        try:
            p = get_real_path(virtual_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            existing = p.read_text(encoding="utf-8") if p.exists() else ""
            new_text = existing + f"\n{content}" if existing else content
            p.write_text(new_text, encoding="utf-8")
            return f"成功向文件 {virtual_path} 追加内容"
        except Exception as e:
            return f"追加出错: {str(e)}"

    @tool
    def edit_file(virtual_path: str, old_string: str, new_string: str) -> str:
        """替换指定文件中的局部文本内容。用于精准更新文件。"""
        if not check_permission("write", virtual_path):
            return f"【权限拒绝】禁止编辑文件: {virtual_path}"
        try:
            p = get_real_path(virtual_path)
            if not p.exists():
                return "文件不存在"
            content = p.read_text(encoding="utf-8")
            if old_string not in content:
                return f"错误：未在文件中找到文本 '{old_string}'"
            p.write_text(content.replace(old_string, new_string, 1), encoding="utf-8")
            return f"成功编辑文件: {virtual_path}"
        except Exception as e:
            return f"编辑出错: {str(e)}"

    return [read_file, write_file, append_file, edit_file, ls]
