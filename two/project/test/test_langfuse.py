import sys
from pathlib import Path

from dotenv import load_dotenv

current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 自动加载根目录的 .env 文件
load_dotenv(project_root / ".env")

from modules.core.llm import default_model
from modules.core.langfuse_handler import get_langfuse_callback

def main():
    print("[1/3] 初始化 Langfuse 链路追踪组件...")
    handler = get_langfuse_callback(session_id="test_session_001", user_id="user_123")
    
    if not handler:
        print("[Warning] .env 文件中未配置正确的 LANGFUSE_PUBLIC_KEY 或 LANGFUSE_SECRET_KEY！")
        print("请登录 https://cloud.langfuse.com 获取并在 .env 中配置后重新运行。")
        return
        
    print("[2/3] 正在发起大模型调用并自动追踪 LLM 交互与 Token 消耗...")
    try:
        response = default_model.invoke(
            "请用一句话解释什么是 AI Agent 的可观测性？",
            config={"callbacks": [handler]}
        )
        print(f"\n模型回复: {response.content}\n")
        
        # 刷盘确保数据发送
        if hasattr(handler, "flush"):
            handler.flush()
        elif hasattr(handler, "langfuse") and hasattr(handler.langfuse, "flush"):
            handler.langfuse.flush()

        print("[3/3] 成功! 本次大模型调用及 Token / 时延数据已成功推送至 Langfuse 面板!")
    except Exception as e:
        print(f"[Error] 调用出错: {str(e)}")

if __name__ == "__main__":
    main()
