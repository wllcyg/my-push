
# mock数据
USER_DB = {
    "001": {"user_id": "001", "name": "张三", "age": 18, "job": "学生"},
    "002": {"user_id": "002", "name": "李四", "age": 25, "job": "程序员"},
}

def get_user(user_id: str):
    """
    查询用户信息
    """
    return USER_DB.get(user_id, {})