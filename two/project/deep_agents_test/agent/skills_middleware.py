import re
from pathlib import Path

def parse_skill_frontmatter(skill_md_path: Path) -> dict:
    """读取 SKILL.md 顶部的 YAML Frontmatter 元数据 (name, description, allowed_roles)"""
    content = skill_md_path.read_text(encoding="utf-8")
    pattern = r"^---\s*\n(.*?)\n---\s*\n"
    match = re.search(pattern, content, re.DOTALL)
    
    metadata = {
        "name": skill_md_path.parent.name, 
        "description": "无描述", 
        "allowed_roles": ["all"], # 默认所有人可用
        "path": str(skill_md_path)
    }
    
    if match:
        yaml_text = match.group(1)
        for line in yaml_text.splitlines():
            if ":" in line:
                key, val = line.split(":", 1)
                clean_key = key.strip()
                clean_val = val.strip().strip('"\'')
                if clean_key == "allowed_roles":
                    # 解析 ["admin", "vip"] 格式
                    roles = [r.strip("[] \"'") for r in clean_val.split(",")]
                    metadata["allowed_roles"] = roles
                else:
                    metadata[clean_key] = clean_val
                
    return metadata

def create_skills_prompt(
    base_prompt: str, 
    root_dir: str | Path, 
    user_role: str = "guest",
    skills_folder: str = ".agents/skills"
) -> str:
    """
    Python 版 Agent Skills 工厂函数（带基于角色的 RBAC 技能过滤）
    只把当前 user_role 有权限访问的技能注入 System Prompt，做到绝对物理隐藏！
    """
    root_path = Path(root_dir).resolve()
    skills_dir = root_path / skills_folder.lstrip("/")
    
    skill_list = []
    
    if skills_dir.exists() and skills_dir.is_dir():
        for skill_path in skills_dir.glob("**/SKILL.md"):
            meta = parse_skill_frontmatter(skill_path)
            
            # 【核心权限检查】: 如果技能要求的角色不在用户的角色权限内，直接无视并隐藏该技能！
            allowed = meta.get("allowed_roles", ["all"])
            if "all" not in allowed and user_role not in allowed:
                continue # 越权技能直接隐藏！
                
            rel_path = "/" + str(skill_path.relative_to(root_path)).replace("\\", "/")
            skill_list.append(f"- **{meta['name']}**: {meta['description']} (SOP路径: `{rel_path}`)")

    if not skill_list:
        skills_instruction = "\n\n【可用技能库】: 当前未激活任何技能库。"
    else:
        joined_skills = "\n".join(skill_list)
        skills_instruction = f"""

<available_skills>
【可用技能库 (Available Skills)】:
{joined_skills}
</available_skills>

【技能调用规范】:
当用户的任务匹配上述某个技能时，你**必须首先调用 `read_file` 工具**去读取该技能对应的 SOP路径 文件！在完全学习并掌握其格式与规范后，再执行后续的任务。
"""

    return base_prompt + skills_instruction
