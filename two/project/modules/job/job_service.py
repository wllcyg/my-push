import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import select

from modules.core.database import AsyncSessionFactory
from modules.job.job_entity import Job
from modules.ai.ai_service import AiService

logger = logging.getLogger("JobService")
logger.setLevel(logging.INFO)

class JobService:
    """
    对应 NestJS 的 JobService，管理基于数据库的动态定时任务
    """
    def __init__(self, scheduler: AsyncIOScheduler):
        self.scheduler = scheduler
        self.ai_service = AiService()  # 相当于 NestJS 里的 jobAgentService

    async def init_jobs(self):
        """
        对应 NestJS 的 onApplicationBootstrap
        服务器启动时，读取所有启用的任务并挂载到调度器
        """
        async with AsyncSessionFactory() as session:
            result = await session.execute(select(Job).where(Job.is_enabled == True))
            enabled_jobs = result.scalars().all()
            
            for job in enabled_jobs:
                if not self.scheduler.get_job(job.id):
                    self._start_runtime(job)

    async def _run_job_task(self, job_id: str, instruction: str, job_type: str):
        """
        任务实际执行的函数（替代 TS 中的 setInterval/setTimeout/CronJob 回调）
        """
        logger.info(f"开始执行任务 {job_id}, 指令: {instruction}")
        
        # 1. 独立执行 AI 逻辑（捕获异常防止崩溃）
        try:
            # 调用支持异步工具的生成逻辑
            result = await self.ai_service.generate_reply_async(instruction)
            logger.info(f"[job {job_id}] 执行结果: {result['reply']}")
        except Exception as e:
            logger.error(f"任务 {job_id} AI 执行出错: {str(e)}")

        # 2. 更新数据库 last_run 状态和 at 任务停用状态
        # 因为后台任务没有全局会话，需要独立开启一个 DB Session
        async with AsyncSessionFactory() as session:
            job = await session.get(Job, job_id)
            if job:
                job.last_run = datetime.now(timezone.utc).replace(tzinfo=None)
                # at 类型只执行一次：执行完自动停用
                if job_type == 'at':
                    job.is_enabled = False
                await session.commit()

    def _start_runtime(self, job: Job):
        """将数据库实体转换为底层的 APScheduler 触发器并启动"""
        if self.scheduler.get_job(job.id):
            return

        if job.type == 'cron':
            # APScheduler 原生支持 crontab 格式，如 "0 12 * * *"
            trigger = CronTrigger.from_crontab(job.cron)
            self.scheduler.add_job(
                self._run_job_task,
                trigger=trigger,
                id=job.id,
                args=[job.id, job.instruction, job.type]
            )
            
        elif job.type == 'every':
            if not job.every_ms or job.every_ms <= 0:
                logger.error(f"任务 {job.id} 的 every_ms 无效")
                return
            
            # APScheduler 的 interval 单位是秒、分、小时等
            trigger = IntervalTrigger(seconds=job.every_ms / 1000.0)
            self.scheduler.add_job(
                self._run_job_task,
                trigger=trigger,
                id=job.id,
                args=[job.id, job.instruction, job.type]
            )

        elif job.type == 'at':
            if not job.at:
                logger.error(f"任务 {job.id} 的 at 时间无效")
                return
            
            # 统一处理时区：如果从数据库出来的是 naive 时间（没有时区），默认它是 UTC
            at_time = job.at
            if at_time.tzinfo is None:
                at_time = at_time.replace(tzinfo=timezone.utc)
            
            # 用带 UTC 时区的当前时间做比较，防止 UTC 和 LocalTime 跨服比对
            if at_time < datetime.now(timezone.utc):
                logger.warning(f"任务 {job.id} 的触发时间已过期 ({at_time})，跳过注册")
                return
                
            trigger = DateTrigger(run_date=at_time)
            self.scheduler.add_job(
                self._run_job_task,
                trigger=trigger,
                id=job.id,
                args=[job.id, job.instruction, job.type]
            )

    def _stop_runtime(self, job_id: str):
        """从调度器中移除任务"""
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

    # ---------------- 暴露给 Controller 的业务方法 ---------------- #

    async def list_jobs(self):
        async with AsyncSessionFactory() as session:
            result = await session.execute(select(Job).order_by(Job.created_at.desc()))
            jobs = result.scalars().all()
            
            res = []
            for job in jobs:
                # 检查该 job_id 是否在 APScheduler 中运行
                running = self.scheduler.get_job(job.id) is not None
                res.append({
                    "id": job.id,
                    "instruction": job.instruction,
                    "type": job.type,
                    "cron": job.cron,
                    "every_ms": job.every_ms,
                    "at": job.at,
                    "is_enabled": job.is_enabled,
                    "last_run": job.last_run,
                    "running": running
                })
            return res

    async def add_job(self, input_data: dict):
        async with AsyncSessionFactory() as session:
            new_job = Job(
                instruction=input_data['instruction'],
                type=input_data['type'],
                cron=input_data.get('cron') if input_data['type'] == 'cron' else None,
                every_ms=input_data.get('everyMs') if input_data['type'] == 'every' else None,
                at=input_data.get('at') if input_data['type'] == 'at' else None,
                is_enabled=input_data.get('isEnabled', True)
            )
            session.add(new_job)
            await session.commit()
            await session.refresh(new_job)
            
            if new_job.is_enabled:
                self._start_runtime(new_job)
                
            return new_job

    async def toggle_job(self, job_id: str, enabled: bool = None):
        async with AsyncSessionFactory() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise Exception(f"Job not found: {job_id}")
            
            next_enabled = enabled if enabled is not None else not job.is_enabled
            if job.is_enabled != next_enabled:
                job.is_enabled = next_enabled
                await session.commit()
                
            if job.is_enabled:
                self._start_runtime(job)
            else:
                self._stop_runtime(job.id)
                
            return job

# ---------------- 导出全局单例 ---------------- #
global_scheduler = AsyncIOScheduler()
job_service_instance = JobService(global_scheduler)
