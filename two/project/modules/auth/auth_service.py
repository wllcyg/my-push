import os
import hmac
import hashlib
import base64
import json
import time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from modules.user.user_entity import User
from modules.auth.auth_dto import RegisterDto, LoginDto, TokenResponseDto, AuthUserResponseDto
from modules.core.response import APIException

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "awesome_supabase_auth_secret_key_2026")

def hash_password(password: str) -> str:
    """
    加盐 pbkdf2_hmac 密码哈希
    """
    salt = os.urandom(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}${pwd_hash.hex()}"

def verify_password(password: str, stored_hash: str | None) -> bool:
    """
    校验密码哈希
    """
    if not stored_hash or "$" not in stored_hash:
        return False
    try:
        salt_hex, pwd_hash_hex = stored_hash.split("$")
        salt = bytes.fromhex(salt_hex)
        expected_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return hmac.compare_digest(expected_hash.hex(), pwd_hash_hex)
    except Exception:
        return False

def create_token(user_id: int, email: str, expires_in_seconds: int = 86400 * 7) -> str:
    """
    签发安全的 Bearer 令牌 (带 HMAC-SHA256 签名)
    """
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": int(time.time()) + expires_in_seconds
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('utf-8').rstrip('=')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"

def decode_token(token: str) -> dict:
    """
    验证并解析 Bearer 令牌
    """
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise APIException(code=40100, message="无效的 Auth Token 格式")
        
        payload_b64, signature = parts
        expected_signature = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise APIException(code=40101, message="Auth Token 签名验证失败")

        # 补全 Base64 padding
        padded_b64 = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded_b64).decode('utf-8'))

        if time.time() > payload.get("exp", 0):
            raise APIException(code=40102, message="Auth Token 已过期，请重新登录")

        return payload
    except APIException:
        raise
    except Exception as e:
        raise APIException(code=40100, message=f"Token 解析错误: {e}")


class AuthService:
    """
    用户认证与注册登录服务
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, dto: RegisterDto) -> TokenResponseDto:
        """
        用户注册
        """
        # 1. 检查邮箱是否重复
        result = await self.db.execute(select(User).where(User.email == dto.email))
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise APIException(code=40002, message=f"邮箱 '{dto.email}' 已被注册，请直接登录")

        # 2. 密码加密并保存新用户
        pwd_hash = hash_password(dto.password)
        new_user = User(
            name=dto.name,
            email=dto.email,
            password_hash=pwd_hash
        )
        self.db.add(new_user)
        await self.db.flush()
        await self.db.refresh(new_user)

        # 3. 签发 Token 并返回
        token = create_token(new_user.id, new_user.email)
        user_dto = AuthUserResponseDto.model_validate(new_user)
        return TokenResponseDto(access_token=token, token_type="bearer", user=user_dto)

    async def login(self, dto: LoginDto) -> TokenResponseDto:
        """
        用户登录
        """
        # 1. 查询用户
        result = await self.db.execute(select(User).where(User.email == dto.email))
        user = result.scalar_one_or_none()

        # 2. 校验是否存在且密码正确
        if not user or not verify_password(dto.password, user.password_hash):
            raise APIException(code=40001, message="邮箱或密码错误，请重试")

        # 3. 签发 Token 并返回
        token = create_token(user.id, user.email)
        user_dto = AuthUserResponseDto.model_validate(user)
        return TokenResponseDto(access_token=token, token_type="bearer", user=user_dto)

    async def get_user_by_id(self, user_id: int) -> User | None:
        """
        根据 ID 查询用户
        """
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
