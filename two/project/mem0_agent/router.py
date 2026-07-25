from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from .service import MemoryService, get_memory_service

router = APIRouter(prefix="/api/v1/memories", tags=["Mem0 Memory Service"])

# --- DTO / Schemas ---

class MessageItem(BaseModel):
    role: str = Field(..., description="角色: user / assistant / system")
    content: str = Field(..., description="对话文本")

class MemoryAddRequest(BaseModel):
    user_id: str = Field(..., description="唯一用户ID")
    messages: List[MessageItem] = Field(..., description="消息列表")
    agent_id: Optional[str] = Field(None, description="可选 Agent ID")
    run_id: Optional[str] = Field(None, description="可选运行会话 ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="自定义元数据")

class MemorySearchRequest(BaseModel):
    user_id: str = Field(..., description="唯一用户ID")
    query: str = Field(..., description="检索关键词或语句")
    agent_id: Optional[str] = Field(None, description="可选 Agent ID")
    run_id: Optional[str] = Field(None, description="可选运行会话 ID")
    limit: Optional[int] = Field(5, description="返回记忆数量上限")

# --- Routes ---

@router.post("/add", summary="保存/抽取用户对话记忆")
async def add_memory(
    req: MemoryAddRequest,
    service: MemoryService = Depends(get_memory_service)
):
    try:
        raw_msgs = [msg.model_dump() for msg in req.messages]
        result = await service.add_async(
            messages=raw_msgs,
            user_id=req.user_id,
            agent_id=req.agent_id,
            run_id=req.run_id,
            metadata=req.metadata
        )
        return {"code": 200, "message": "Memory added successfully", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search", summary="语义检索相关记忆")
async def search_memory(
    req: MemorySearchRequest,
    service: MemoryService = Depends(get_memory_service)
):
    try:
        results = await service.search_async(
            query=req.query,
            user_id=req.user_id,
            agent_id=req.agent_id,
            run_id=req.run_id,
            limit=req.limit or 5
        )
        return {"code": 200, "message": "Success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list/{user_id}", summary="获取指定用户的所有记忆")
async def get_user_memories(
    user_id: str,
    agent_id: Optional[str] = None,
    service: MemoryService = Depends(get_memory_service)
):
    try:
        results = await service.get_all_async(user_id=user_id, agent_id=agent_id)
        return {"code": 200, "message": "Success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{memory_id}", summary="删除特定记忆")
async def delete_memory(
    memory_id: str,
    service: MemoryService = Depends(get_memory_service)
):
    try:
        result = await service.delete_async(memory_id=memory_id)
        return {"code": 200, "message": "Deleted successfully", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
