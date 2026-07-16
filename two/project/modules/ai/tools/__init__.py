from .get_user import get_user
from .send_mail import send_mail
from .time_now import time_now
from .web_search import web_search
from .db_users_crud import db_users_crud

# 统一维护一个所有可用工具的列表
ALL_TOOLS = [
    get_user,
    send_mail,
    time_now,
    web_search,
    db_users_crud
]
