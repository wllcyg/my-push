from typing import Literal, Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from sqlalchemy import select

from modules.core.database import AsyncSessionFactory
from modules.user.user_entity import User

# 🚀 最佳实践: 定义严格的参数 Schema 并给大模型写清楚字段说明
class DbUsersCrudInput(BaseModel):
    action: Literal['create', 'list', 'get', 'update', 'delete'] = Field(
        description="要执行的操作：create、list、get、update、delete"
    )
    id: Optional[int] = Field(
        None, description="用户 ID（get / update / delete 时需要）"
    )
    name: Optional[str] = Field(
        None, description="用户姓名（create 或 update 时可用）"
    )
    email: Optional[str] = Field(
        None, description="用户邮箱（create 或 update 时可用）"
    )

@tool('db_users_crud', args_schema=DbUsersCrudInput)
async def db_users_crud(
    action: Literal['create', 'list', 'get', 'update', 'delete'],
    id: Optional[int] = None,
    name: Optional[str] = None,
    email: Optional[str] = None
) -> str:
    """
    对数据库 users 表执行增删改查操作。
    通过 action 字段选择 create/list/get/update/delete，并按需提供 id、name、email 等参数。
    """
    # 直接在 Tool 内部使用 AsyncSessionFactory 创建会话
    async with AsyncSessionFactory() as session:
        try:
            if action == 'create':
                if not name or not email:
                    return "创建用户需要同时提供 name 和 email。"
                
                new_user = User(name=name, email=email)
                session.add(new_user)
                await session.commit()
                await session.refresh(new_user)
                return f"已创建用户：ID={new_user.id}，姓名={new_user.name}，邮箱={new_user.email}"

            elif action == 'list':
                result = await session.execute(select(User))
                users = result.scalars().all()
                if not users:
                    return "数据库中还没有任何用户记录。"
                
                lines = [
                    f"ID={u.id}，姓名={u.name}，邮箱={u.email}，创建时间={u.created_at.strftime('%Y-%m-%d %H:%M:%S') if u.created_at else ''}" 
                    for u in users
                ]
                return "当前数据库 users 表中的用户列表：\n" + "\n".join(lines)

            elif action == 'get':
                if not id:
                    return "查询单个用户需要提供 id。"
                
                user = await session.get(User, id)
                if not user:
                    return f"ID 为 {id} 的用户在数据库中不存在。"
                return f"用户信息：ID={user.id}，姓名={user.name}，邮箱={user.email}，创建时间={user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else ''}"

            elif action == 'update':
                if not id:
                    return "更新用户需要提供 id。"
                if name is None and email is None:
                    return "未提供需要更新的字段（name 或 email），本次不执行更新。"

                user = await session.get(User, id)
                if not user:
                    return f"ID 为 {id} 的用户在数据库中不存在。"
                
                if name is not None:
                    user.name = name
                if email is not None:
                    user.email = email
                    
                await session.commit()
                await session.refresh(user)
                return f"已更新用户：ID={user.id}，姓名={user.name}，邮箱={user.email}"

            elif action == 'delete':
                if not id:
                    return "删除用户需要提供 id。"
                
                user = await session.get(User, id)
                if not user:
                    return f"ID 为 {id} 的用户在数据库中不存在，无需删除。"
                
                await session.delete(user)
                await session.commit()
                return f"已删除用户：ID={id}，姓名={user.name}，邮箱={user.email}"

        except Exception as e:
            await session.rollback()
            return f"执行数据库操作时发生错误: {str(e)}"
