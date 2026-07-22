from .get_user import get_user
from .send_mail import send_mail
from .time_now import time_now
from .web_search import web_search
from .db_users_crud import db_users_crud
from .job_crud import job_crud
from .python_repl import python_repl
from .file_tools import read_file, write_file
from .todo_tools import write_todos

# 统一维护一个所有可用工具的列表
ALL_TOOLS = [
    get_user,
    send_mail,
    time_now,
    web_search,
    db_users_crud,
    job_crud,
    python_repl,
    read_file,
    write_file,
    write_todos
]
