from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from modules.core.database import get_db
from modules.core.response import StandardResponse, success, UserNotFoundError
from modules.user.user_service import UserService
from modules.user.user_dto import CreateUserDto, UpdateUserDto, UserResponseDto

# 对应 NestJS 的 @Controller('users')
router = APIRouter(prefix="/users", tags=["用户模块"])


# 依赖提供者：每次请求创建一个 UserService 实例，自动注入 db session
def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


# ─────────────────────────────────────────────
# POST /users  →  创建用户
# 对应 NestJS 的 @Post() create(@Body() dto: CreateUserDto)
# ─────────────────────────────────────────────
@router.post("/", response_model=StandardResponse[UserResponseDto])
async def create(dto: CreateUserDto, service: UserService = Depends(get_user_service)):
    user = await service.create(dto)
    return success(user)


# ─────────────────────────────────────────────
# GET /users  →  查询所有用户
# 对应 NestJS 的 @Get() findAll()
# ─────────────────────────────────────────────
@router.get("/", response_model=StandardResponse[list[UserResponseDto]])
async def find_all(service: UserService = Depends(get_user_service)):
    users = await service.find_all()
    return success(users)


# ─────────────────────────────────────────────
# GET /users/:id  →  查询单个用户
# 对应 NestJS 的 @Get(':id') findOne(@Param('id') id: number)
# ─────────────────────────────────────────────
@router.get("/{id}", response_model=StandardResponse[UserResponseDto])
async def find_one(id: int, service: UserService = Depends(get_user_service)):
    user = await service.find_one(id)
    if not user:
        raise UserNotFoundError(id=id)
    return success(user)


# ─────────────────────────────────────────────
# PATCH /users/:id  →  更新用户
# 对应 NestJS 的 @Patch(':id') update(@Param('id') id, @Body() dto: UpdateUserDto)
# ─────────────────────────────────────────────
@router.patch("/{id}", response_model=StandardResponse[UserResponseDto])
async def update(id: int, dto: UpdateUserDto, service: UserService = Depends(get_user_service)):
    user = await service.update(id, dto)
    if not user:
        raise UserNotFoundError(id=id)
    return success(user)


# ─────────────────────────────────────────────
# DELETE /users/:id  →  删除用户
# 对应 NestJS 的 @Delete(':id') remove(@Param('id') id: number)
# ─────────────────────────────────────────────
@router.delete("/{id}", response_model=StandardResponse[None])
async def remove(id: int, service: UserService = Depends(get_user_service)):
    success_flag = await service.remove(id)
    if not success_flag:
        raise UserNotFoundError(id=id)
    return success()
