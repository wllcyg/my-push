from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from modules.core.database import get_db
from modules.core.response import StandardResponse, success, APIException
from modules.auth.auth_service import AuthService, decode_token
from modules.auth.auth_dto import RegisterDto, LoginDto, TokenResponseDto, AuthUserResponseDto

router = APIRouter(prefix="/auth", tags=["认证模块"])

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)

async def get_current_user(
    authorization: str | None = Header(None, alias="Authorization"),
    service: AuthService = Depends(get_auth_service)
) -> AuthUserResponseDto:
    """
    依赖注入拦截器：从请求头获取 Bearer Token 并鉴权提取当前用户
    """
    if not authorization:
        raise APIException(code=40100, message="缺少 Authorization 认证请求头")

    token_parts = authorization.split(" ")
    if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
        raise APIException(code=40100, message="Authorization 请求头格式必须为 'Bearer <token>'")

    token = token_parts[1]
    payload = decode_token(token)
    user_id = int(payload["sub"])

    user = await service.get_user_by_id(user_id)
    if not user:
        raise APIException(code=40103, message="当前登录用户不存在或已被删除")

    return AuthUserResponseDto.model_validate(user)


@router.post("/register", response_model=StandardResponse[TokenResponseDto])
async def register(dto: RegisterDto, service: AuthService = Depends(get_auth_service)):
    """
    用户注册接口
    """
    result = await service.register(dto)
    return success(result)


@router.post("/login", response_model=StandardResponse[TokenResponseDto])
async def login(dto: LoginDto, service: AuthService = Depends(get_auth_service)):
    """
    用户登录接口
    """
    result = await service.login(dto)
    return success(result)


@router.get("/me", response_model=StandardResponse[AuthUserResponseDto])
async def get_me(current_user: AuthUserResponseDto = Depends(get_current_user)):
    """
    获取当前登录用户信息接口
    """
    return success(current_user)
