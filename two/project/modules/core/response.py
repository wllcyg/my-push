from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

# 定义泛型 T
T = TypeVar("T")

class StandardResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = "success"
    data: Optional[T] = None

def success(data: Any = None, message: str = "success") -> StandardResponse:
    """快捷返回成功响应"""
    return StandardResponse(code=0, message=message, data=data)

# ----------------- 异常定义 -----------------
class APIException(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message

class UserNotFoundError(APIException):
    def __init__(self, id: int):
        super().__init__(code=10001, message=f"用户 {id} 不存在")
