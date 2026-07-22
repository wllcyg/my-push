import sys
import contextlib
from io import StringIO
from langchain_core.tools import tool

@tool
def python_repl(code: str) -> str:
    """一个 Python 代码执行沙箱（REPL）。
    使用此工具来执行 Python 代码以进行数值计算、数据分析等。
    输入必须是一段有效的 Python 代码字符串。
    如果你想查看某个变量的结果，请使用 `print(...)` 将其打印出来。
    """
    stdout = StringIO()
    try:
        # 重定向标准输出以捕获 print 等输出结果
        with contextlib.redirect_stdout(stdout):
            # 执行传入的代码，传入一个空的全局变量字典来保证每次执行有一定的隔离性
            # 或者也可以传入 globals() 保持状态，此处为了简单起见，每次执行都是一个干净的命名空间
            exec(code, {})
        output = stdout.getvalue()
    except Exception as e:
        output = f"执行出错: {type(e).__name__}: {str(e)}"
    return output
