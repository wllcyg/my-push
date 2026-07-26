import os
import sys
import json
import threading
from pathlib import Path
from typing import Optional, Dict, Any
from loguru import logger
import httpx

from modules.config.settings import get_settings

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

class AxiomLogSink:
    """
    Axiom 云端日志接收器 (Sink)
    负责把 Loguru 产生的结构化日志通过 HTTP 异步发送给 Axiom API
    """
    def __init__(self, token: Optional[str] = None, dataset: str = "my-push-backend"):
        settings = get_settings()
        self.token = token or settings.axiom_token or os.getenv("AXIOM_TOKEN", "")
        self.dataset = dataset or settings.axiom_dataset or os.getenv("AXIOM_DATASET", "my-push-backend")
        self.api_url = f"https://api.axiom.co/v1/datasets/{self.dataset}/ingest"
        self.enabled = bool(self.token and not self.token.startswith("your-"))

    def write(self, message):
        """Loguru Sink 的回调方法"""
        if not self.enabled:
            return

        record = message.record
        log_payload = [
            {
                "_time": record["time"].isoformat(),
                "level": record["level"].name,
                "message": record["message"],
                "logger": record["name"],
                "function": record["function"],
                "line": record["line"],
                "environment": os.getenv("ENV", "development"),
                "extra": record["extra"] if record.get("extra") else {}
            }
        ]

        # Loguru 在 add 时如果配置了 enqueue=True，此回调函数本身就在后台子线程中执行
        self._send_to_axiom(log_payload)

    def _ensure_dataset_exists(self, client: httpx.Client, headers: dict):
        """如果 Dataset 不存在，自动通过 Axiom API 创建"""
        try:
            create_url = "https://api.axiom.co/v1/datasets"
            body = {
                "name": self.dataset,
                "description": "My Push Backend Logs"
            }
            res = client.post(create_url, headers=headers, json=body)
            if res.status_code in (200, 201):
                print(f"[Axiom Log] 自动创建 Dataset `{self.dataset}` 成功!")
                return True
        except Exception as e:
            print(f"[Axiom Exception] 创建 Dataset 失败: {str(e)}")
        return False

    def _send_to_axiom(self, payload: list):
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            with httpx.Client(timeout=5.0) as client:
                res = client.post(self.api_url, headers=headers, json=payload)
                if res.status_code in (200, 201):
                    print(f"[Axiom Log] 日志已成功同步至 Dataset `{self.dataset}`")
                elif res.status_code == 404:
                    print(f"[Axiom Info] 检测到 Dataset `{self.dataset}` 不存在，正在尝试自动创建...")
                    if self._ensure_dataset_exists(client, headers):
                        # 重试发送
                        retry_res = client.post(self.api_url, headers=headers, json=payload)
                        if retry_res.status_code in (200, 201):
                            print(f"[Axiom Log] 日志重试同步至 Dataset `{self.dataset}` 成功!")
                else:
                    print(f"[Axiom Error] 上传失败! HTTP {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[Axiom Exception] 请求异常: {str(e)}")

# 移除默认的 handler
logger.remove()

# 1. 输出到控制台
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)

# 2. 输出到本地文件 (按天切分，保留 14 天)
logger.add(
    LOG_DIR / "backend_app_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="14 days",
    encoding="utf-8",
    level="INFO",
    enqueue=True
)

# 3. 输出到 Axiom 云端服务
axiom_sink = AxiomLogSink()
if axiom_sink.enabled:
    logger.add(axiom_sink.write, level="INFO", enqueue=True)

__all__ = ["logger"]
