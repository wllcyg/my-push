"""
Celery 分布式异步任务应用与配置
================================
基于 Celery + RabbitMQ (Broker) + Redis (Result Backend) 的企业级解耦方案

使用说明：
  1. 启动 Worker 进程：
     celery -A modules.job.celery_app.celery_app worker --loglevel=info -P solaris
  2. 触发任务：
     from modules.job.celery_app import generate_ai_report_task
     res = generate_ai_report_task.delay("写一份 Python 总结报告", user_id=1)
"""

import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from celery import Celery

# 加载 .env 环境变量
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Broker & Backend URL 配置（优先读取 .env）
BROKER_URL = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
# 使用 rpc:// 作为默认 Backend，直接利用 RabbitMQ 存储任务结果，免去依赖本地 6379 Redis 端口
BACKEND_URL = os.getenv("CELERY_RESULT_BACKEND", "rpc://")

# 初始化 Celery App 实例
celery_app = Celery(
    "ai_async_jobs",
    broker=BROKER_URL,
    backend=BACKEND_URL
)

# 生产级安全配置
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=True,
    result_expires=86400,            # 任务结果保存 24 小时
    task_acks_late=True,             # 延迟 ACK，运行完才确认，防止 Worker 挂掉丢任务
    task_reject_on_worker_lost=True, # Worker 意外挂掉时任务自动返回队列重新分发
    worker_prefetch_multiplier=1,    # 每个 Worker 每次只预取 1 个长任务，保证公平调度
)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def generate_ai_report_task(self, prompt: str, user_id: int = 1, session_id: str = None):
    """
    异步长耗时 AI 报告/文本生成 Task (后台 Worker 执行)
    """
    print(f"🚀 [Celery Worker] 收到长耗时 AI 生成任务 (Task ID: {self.request.id})")
    print(f"   Prompt: '{prompt}', User ID: {user_id}")

    try:
        from modules.ai.ai_service import AiService
        from modules.core.database import AsyncSessionFactory

        async def _run_ai_job():
            ai_svc = AiService()
            async with AsyncSessionFactory() as db:
                result = await ai_svc.generate_reply_async(
                    prompt=prompt,
                    user_id=user_id,
                    session_id=session_id,
                    db=db,
                    auto_route_async=False
                )
                await db.commit()
                return result

        # 使用 asyncio.run 驱动底层异步逻辑
        reply_dict = asyncio.run(_run_ai_job())
        print(f"✅ [Celery Worker] 任务 {self.request.id} 生成成功！")
        return reply_dict

    except Exception as exc:
        print(f"❌ [Celery Worker] 任务 {self.request.id} 发生错误: {exc}，正在重试...")
        # 指数退避重试
        raise self.retry(exc=exc)
