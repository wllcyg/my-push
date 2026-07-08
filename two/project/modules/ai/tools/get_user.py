from langchain_core.tools import tool
from pydantic import BaseModel, Field

# 从我们刚刚写的 service 中引入极简的业务逻辑
# 为了防止和当前的工具函数名字冲突，我们可以用 as 给它起个别名
from modules.ai.user_service import get_user as get_user_service

class QueryUserArgs(BaseModel):
    user_id: str = Field(description="需要查询的用户 ID，例如：001、002")

@tool('get_user', args_schema=QueryUserArgs)
def get_user(user_id: str) -> str:
    """
    这是一个用于查询用户信息的工具。
    输入用户 ID，它会返回对应用户的详细信息，包括姓名、年龄和职业。
    """
    # 核心优势：直接调用外部的 Service
    user = get_user_service(user_id)
    
    # 判空，字典为空说明没查到
    if not user:
        return f"用户 ID 为 {user_id} 的用户不存在"
        
    return str(user)