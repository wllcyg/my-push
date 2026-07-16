from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from modules.user.user_entity import User
from modules.user.user_dto import CreateUserDto, UpdateUserDto


class UserService:
    """
    用户 Service（对应 NestJS 的 @Injectable() UsersService）
    负责所有用户相关的业务逻辑，通过 AsyncSession 操作数据库
    """

    def __init__(self, db: AsyncSession):
        # 对应 NestJS 的 @Inject(EntityManager) entityManager: EntityManager
        self.db = db

    async def create(self, dto: CreateUserDto) -> User:
        """
        创建用户（对应 entityManager.save(User, createUserDto)）
        """
        user = User(name=dto.name, email=dto.email)
        self.db.add(user)
        await self.db.flush()   # 写入但不提交，让 id 等自动生成字段填充
        await self.db.refresh(user)  # 从数据库刷新，获取最新状态
        return user

    async def find_all(self) -> list[User]:
        """
        查询所有用户（对应 entityManager.find(User)）
        """
        result = await self.db.execute(select(User))
        return result.scalars().all()

    async def find_one(self, id: int) -> User | None:
        """
        根据 ID 查询单个用户（对应 entityManager.findOne(User, { where: { id } })）
        """
        result = await self.db.execute(select(User).where(User.id == id))
        return result.scalar_one_or_none()

    async def update(self, id: int, dto: UpdateUserDto) -> User | None:
        """
        更新用户（对应 entityManager.update(User, id, updateUserDto)）
        只更新 DTO 中不为 None 的字段
        """
        # 过滤掉值为 None 的字段，避免覆盖原有数据
        update_data = dto.model_dump(exclude_none=True)
        if not update_data:
            return await self.find_one(id)

        await self.db.execute(
            update(User).where(User.id == id).values(**update_data)
        )
        return await self.find_one(id)

    async def remove(self, id: int) -> bool:
        """
        删除用户（对应 entityManager.delete(User, id)）
        返回是否成功删除
        """
        result = await self.db.execute(
            delete(User).where(User.id == id)
        )
        return result.rowcount > 0
