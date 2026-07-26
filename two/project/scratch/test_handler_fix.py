import os
import sys
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(__file__).resolve().parent.parent
load_dotenv(project_root / ".env")

try:
    from langfuse.langchain import CallbackHandler
    print("Trying CallbackHandler()...")
    # 不传参数，靠环境变量全自动读取
    h = CallbackHandler()
    print("Success empty args h:", h)
except Exception as e:
    print("Error:", e)
