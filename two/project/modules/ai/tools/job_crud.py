from typing import Literal, Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from datetime import datetime

# 移除顶部导入以防止循环依赖
# from modules.job.job_service import job_service_instance

class JobCrudInput(BaseModel):
    action: Literal['list', 'add', 'toggle'] = Field(
        description="要执行的操作：list、add、toggle"
    )
    id: Optional[str] = Field(
        None, description="任务 ID（toggle 时需要）"
    )
    enabled: Optional[bool] = Field(
        None, description="是否启用（toggle 可选；不传则自动取反）"
    )
    type: Optional[Literal['cron', 'every', 'at']] = Field(
        None, description="任务类型（add 时需要）：cron（按 Cron 表达式循环执行）/ every（按固定间隔毫秒循环执行）/ at（在指定时间点执行一次，执行后自动停用）"
    )
    instruction: Optional[str] = Field(
        None, description="任务说明/指令（add 时需要）。要求：\n1) 从用户自然语言中去掉“什么时候执行”的定时部分后，保留纯粹要执行的任务内容。\n2) 必须是自然语言描述，不能是工具调用或代码（例如不能写 send_mail(...)）。\n3) 不要擅自补全细节或改写成脚本。"
    )
    cron: Optional[str] = Field(
        None, description="Cron 表达式（type=cron 时需要，例如 0 8 * * *）"
    )
    everyMs: Optional[int] = Field(
        None, description="固定间隔毫秒（type=every 时需要，例如 60000 表示每分钟执行一次）"
    )
    at: Optional[datetime] = Field(
        None, description="指定触发时间点（type=at 时需要，ISO 字符串，例如 2026-03-18T12:34:56.000Z）"
    )

@tool('job_crud', args_schema=JobCrudInput)
async def job_crud(
    action: Literal['list', 'add', 'toggle'],
    id: Optional[str] = None,
    enabled: Optional[bool] = None,
    type: Optional[Literal['cron', 'every', 'at']] = None,
    instruction: Optional[str] = None,
    cron: Optional[str] = None,
    everyMs: Optional[int] = None,
    at: Optional[datetime] = None
) -> str:
    """
    管理服务端定时任务（支持 list/add/toggle）。
    类型语义：
    - type=at：到指定时间点只执行一次，执行后自动停用。
    - type=every：按固定毫秒间隔循环执行。
    - type=cron：按 Cron 表达式循环执行。
    """
    try:
        # 在函数内部延迟导入，打破与 job_service 的循环依赖
        from modules.job.job_service import job_service_instance
        
        if action == 'list':
            jobs = await job_service_instance.list_jobs()
            if not jobs:
                return "当前没有任何定时任务。"
            
            lines = []
            for j in jobs:
                at_str = j['at'].isoformat() if j['at'] else ''
                last_run_str = j['last_run'].isoformat() if j['last_run'] else '尚未执行'
                lines.append(
                    f"id={j['id']} type={j['type']} enabled={j['is_enabled']} running={j['running']} "
                    f"cron={j['cron'] or ''} everyMs={j['every_ms'] or ''} at={at_str} "
                    f"last_run={last_run_str} instruction={j['instruction']}"
                )
            return "当前定时任务列表（type 说明：cron=按表达式循环；every=按间隔循环；at=到点执行一次后自动停用）：\n" + "\n".join(lines)

        elif action == 'add':
            if not type:
                return "新增任务需要提供 type（cron/every/at）。"
            if not instruction:
                return "新增任务需要提供 instruction。"

            input_data = {
                'type': type,
                'instruction': instruction,
                'isEnabled': True
            }

            if type == 'cron':
                if not cron:
                    return "type=cron 时需要提供 cron。"
                input_data['cron'] = cron
                created = await job_service_instance.add_job(input_data)
                return f"已新增定时任务：id={created.id} type=cron cron={created.cron} enabled={created.is_enabled}"

            elif type == 'every':
                if not everyMs or everyMs <= 0:
                    return "type=every 时需要提供 everyMs（正整数，单位毫秒）。"
                input_data['everyMs'] = everyMs
                created = await job_service_instance.add_job(input_data)
                return f"已新增定时任务：id={created.id} type=every everyMs={created.every_ms} enabled={created.is_enabled}"

            elif type == 'at':
                if not at:
                    return "type=at 时需要提供 at（ISO 时间字符串）。"
                input_data['at'] = at
                created = await job_service_instance.add_job(input_data)
                return f"已新增定时任务：id={created.id} type=at at={created.at.isoformat()} enabled={created.is_enabled}"

            return f"不支持的任务类型: {type}"

        elif action == 'toggle':
            if not id:
                return "toggle 任务需要提供 id。"
            updated = await job_service_instance.toggle_job(id, enabled)
            return f"已更新任务状态：id={updated.id} enabled={updated.is_enabled}"

        else:
            return f"不支持的操作: {action}"
            
    except Exception as e:
        return f"执行任务操作时发生错误: {str(e)}"
