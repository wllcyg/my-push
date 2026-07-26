import os
from typing import Optional, List, Any
from modules.config.settings import get_settings

def get_langfuse_callback(**kwargs) -> Optional[Any]:
    """
    获取 Langfuse 可观测性 CallbackHandler。
    支持在 LangChain/LangGraph 或 Agent invoke 时作为 callbacks 传入。
    """
    settings = get_settings()
    
    # 优先直接读取环境变量，未读取到时使用 settings
    public_key = (os.getenv("LANGFUSE_PUBLIC_KEY") or settings.langfuse_public_key or "").strip("\"'")
    secret_key = (os.getenv("LANGFUSE_SECRET_KEY") or settings.langfuse_secret_key or "").strip("\"'")
    host = (os.getenv("LANGFUSE_BASE_URL") or os.getenv("LANGFUSE_HOST") or settings.langfuse_host or "https://cloud.langfuse.com").strip("\"'")

    # 检查 Key 是否已有效配置
    if not public_key or not secret_key or public_key.startswith("pk-lf-your"):
        print(f"[Debug] Langfuse Key 未生效: public_key='{public_key[:8]}...', secret_key='{secret_key[:8]}...'")
        return None

    try:
        try:
            from langfuse.langchain import CallbackHandler
        except ImportError:
            from langfuse.callback import CallbackHandler

        # 优先使用环境变量全自动读取构造 Handler (新版 langfuse SDK 标准做法)
        try:
            handler = CallbackHandler()
        except Exception:
            # 降级备用构造
            handler = CallbackHandler(public_key=public_key, host=host)

        return handler
    except ImportError:
        print("[Warning] 未安装 `langfuse` 依赖包，请运行: uv pip install langfuse")
        return None
    except Exception as e:
        print(f"[Warning] Langfuse CallbackHandler 初始化失败: {str(e)}")
        return None

def get_langfuse_callbacks(**kwargs) -> List[Any]:
    """
    方便直接塞入 LangChain callbacks=[] 列表的辅助方法
    """
    handler = get_langfuse_callback(**kwargs)
    return [handler] if handler else []
