from pathlib import Path

def create_memory_prompt(
    base_prompt: str, 
    root_dir: str | Path, 
    sources: list[str]
) -> str:
    """
    通用记忆注入器，动态读取 sources 列表中的 Markdown 记忆文件并注入 System Prompt。
    """
    root_path = Path(root_dir).resolve()
    memory_blocks = []

    for rel_path in sources:
        clean_path = rel_path.lstrip("/")
        file_path = root_path / clean_path
        
        if file_path.exists():
            content = file_path.read_text(encoding="utf-8")
            memory_blocks.append(f"【记忆文件 ({rel_path})】:\n{content}")
        else:
            memory_blocks.append(f"【记忆文件 ({rel_path})】:\n(空)")

    joined_memory = "\n\n".join(memory_blocks)

    memory_instructions = f"""

<agent_memory>
{joined_memory}
</agent_memory>

根据 <agent_memory> 回答问题。
当用户要求“记住”某些信息时，必须立刻使用 write_file / edit_file 工具将新信息更新写入到对应的记忆文件中！
"""
    return base_prompt + memory_instructions
