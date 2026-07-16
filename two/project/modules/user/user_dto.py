from pydantic import BaseModel, Field, field_validator
import re


class CreateUserDto(BaseModel):
    """
    创建用户 DTO（对应 NestJS 的 CreateUserDto）
    """
    # @IsNotEmpty() + @MaxLength(50) → Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=50, description="用户姓名")
    # @IsNotEmpty() + @IsEmail() + @MaxLength(50)
    email: str = Field(..., min_length=1, max_length=50, description="用户邮箱")

    # 对应 @IsEmail() 装饰器，用正则校验邮箱格式
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("邮箱格式不正确")
        return v.lower()  # 统一转为小写


class UpdateUserDto(BaseModel):
    """
    更新用户 DTO（对应 NestJS 的 UpdateUserDto）
    所有字段均为可选，只传入需要修改的字段
    """
    name: str | None = Field(None, min_length=1, max_length=50, description="用户姓名")
    email: str | None = Field(None, min_length=1, max_length=50, description="用户邮箱")

    # 传了 email 才校验格式，没传（None）则跳过
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


class UserResponseDto(BaseModel):
    """
    返回给前端的用户数据结构
    """
    id: int
    name: str
    email: str

    # 让 Pydantic 能直接从 SQLAlchemy ORM 对象读取字段（相当于 class-transformer）
    model_config = {"from_attributes": True}
