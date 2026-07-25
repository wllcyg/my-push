from datetime import datetime
from pydantic import BaseModel, Field


class RegisterDto(BaseModel):
    """
    用户注册 DTO
    """
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", description="用户邮箱")
    password: str = Field(..., min_length=6, description="登录密码 (至少6位)")
    name: str = Field(..., min_length=1, max_length=50, description="用户昵称/姓名")


class LoginDto(BaseModel):
    """
    用户登录 DTO
    """
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", description="用户邮箱")
    password: str = Field(..., description="登录密码")


class AuthUserResponseDto(BaseModel):
    """
    认证返回的用户信息 DTO
    """
    id: int
    email: str
    name: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class TokenResponseDto(BaseModel):
    """
    登录成功返回的 Token 及用户信息
    """
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponseDto
