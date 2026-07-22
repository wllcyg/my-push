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
        "allowed_roles": ["all"],
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
                    roles = [r.strip("[] \"'") for r in clean_val.split(",")]
                    metadata["allowed_roles"] = roles
                else:
                    metadata[clean_key] = clean_val
                    
    return metadata

def create_skills_prompt(
    base_prompt: str, 
    root_dir: str | Path, 
    skills_folder: str = ".agents/skills",
    agent_role: str = "all"
) -> str:
    """自动扫描技能目录中的 SKILL.md 文件并格式化注入到 System Prompt"""
    root_path = Path(root_dir).resolve()
    skills_path = root_path / skills_folder
    
    if not skills_path.exists():
        return base_prompt

    available_skills = []
    
    for item in skills_path.iterdir():
        if item.is_dir():
            skill_md = item / "SKILL.md"
            if skill_md.exists():
                meta = parse_skill_frontmatter(skill_md)
                allowed = meta.get("allowed_roles", ["all"])
                if "all" in allowed or agent_role in allowed:
                    available_skills.append(meta)
                    
    if not available_skills:
        return base_prompt
        
    skills_xml_list = []
    for s in available_skills:
        skills_xml_list.append(f"""  <skill>
    <name>{s['name']}</name>
    <description>{s['description']}</description>
    <location>{s['path']}</location>
  </skill>""")
  
    joined_skills = "\n".join(skills_xml_list)
    
    skills_instruction = f"""

<available_skills>
{joined_skills}
</available_skills>

如果你判断任务需要使用上述技能，请先用 read_file 工具读取对应 location 路径下的 SKILL.md 文件获取详细指南。
"""
    return base_prompt + skills_instruction
