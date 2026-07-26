import time
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from modules.core.logger import logger

class APILoggingMiddleware(BaseHTTPMiddleware):
    """
    FastAPI 全局自动化 Controller 日志中间件
    自动记录所有 API 请求的 Trace ID、URL、响应状态码、处理耗时以及未捕获异常。
    """
    async def dispatch(self, request: Request, call_next):
        # 1. 生成或获取全局唯一的 Trace ID
        trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4())[:8])
        start_time = time.time()

        url_path = request.url.path
        method = request.method
        
        # 忽略健康检查等频繁的微小请求日志（可根据需要扩展）
        is_health_check = url_path in ("/health", "/favicon.ico")

        if not is_health_check:
            logger.bind(trace_id=trace_id).info(f"--> [{method}] {url_path}")

        try:
            # 2. 执行 Controller 路由处理逻辑
            response: Response = await call_next(request)
            
            # 3. 计算接口响应耗时
            process_time = round((time.time() - start_time) * 1000, 2)
            status_code = response.status_code
            
            if not is_health_check:
                logger.bind(trace_id=trace_id).info(
                    f"<-- [{method}] {url_path} | 状态码: {status_code} | 耗时: {process_time}ms"
                )
            
            response.headers["X-Trace-ID"] = trace_id
            return response

        except Exception as e:
            # 4. 如果 Controller 内部崩溃抛错，自动捕捉完整 Exception 堆栈并上传
            process_time = round((time.time() - start_time) * 1000, 2)
            logger.bind(trace_id=trace_id).exception(
                f"❌ [{method}] {url_path} 内部崩溃 | 耗时: {process_time}ms | 异常: {str(e)}"
            )
            raise e
