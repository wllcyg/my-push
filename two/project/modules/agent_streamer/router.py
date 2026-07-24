import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from deep_agents_test.deep_research.agnet import orchestrator_agent
from modules.agent_streamer.event_parser import parse_agent_events, WORKSPACE_DIR

router = APIRouter(prefix="/api/agent", tags=["Deep Research Agent Stream"])


class ResearchRequest(BaseModel):
    query: str
    recursion_limit: Optional[int] = 100


@router.post("/stream_research")
async def stream_research(req: ResearchRequest):
    """
    订阅 Deep Research Agent 执行全过程的 SSE 事件流
    前端通过 POST 发送调研目标问题，获取流式节点与报告更新
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="调研问题不能为空")

    input_messages = {
        "messages": [("user", req.query.strip())]
    }
    
    config = {
        "recursion_limit": req.recursion_limit or 30
    }

    return StreamingResponse(
        parse_agent_events(orchestrator_agent, input_messages, config=config),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用 Nginx 等反向代理缓存
        }
    )


@router.get("/reports")
async def list_reports():
    """
    列出 workspace 目录下所有已生成的报告与 Markdown 文件
    """
    if not WORKSPACE_DIR.exists():
        return {"reports": []}

    files = []
    # 递归检索所有 .md 文件
    for f in WORKSPACE_DIR.glob("**/*.md"):
        files.append({
            "name": f.name,
            "relative_path": str(f.relative_to(WORKSPACE_DIR)),
            "size": f.stat().st_size,
            "updated_at": f.stat().st_mtime
        })
    
    # 按修改时间倒序排列
    files.sort(key=lambda x: x["updated_at"], reverse=True)
    return {"reports": files}


@router.get("/reports/{filename}")
async def get_report_content(filename: str):
    """
    获取指定报告 Markdown 文件的详细内容
    """
    safe_filename = Path(filename).name
    # 递归查找相符文件名
    matched = list(WORKSPACE_DIR.glob(f"**/{safe_filename}"))
    if not matched:
        raise HTTPException(status_code=404, detail="报告文件不存在")

    file_path = matched[0]
    try:
        content = file_path.read_text(encoding="utf-8")
        return {
            "filename": safe_filename,
            "relative_path": str(file_path.relative_to(WORKSPACE_DIR)),
            "content": content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取报告失败: {str(e)}")
