import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    // 忽略非 HTTP 上下文（如 RabbitMQ 消息消费 / RPC 调用的异常）
    if (host.getType() !== 'http') {
      this.logger.error(
        `Unhandled Exception (${host.getType()}): ${(exception as Error)?.message || exception}`,
        (exception as Error)?.stack,
      );
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error)?.message || 'Internal Server Error';

    const stack = (exception as Error)?.stack;

    // 结构化打印异常日志：4xx 记为 warn 告警，5xx 记为 error 堆栈报错
    const logPayload = {
      message: `HTTP Exception: ${request.method} ${request.url} [Status: ${status}]`,
      path: request.url,
      method: request.method,
      statusCode: status,
      errorMessage: message,
      ip: request.ip,
    };

    if (status >= 500) {
      this.logger.error(logPayload, stack, 'Exceptions');
    } else {
      this.logger.warn(logPayload, 'Exceptions');
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' ? (message as any).message || message : message,
      error: status === 500 ? 'Internal Server Error' : (exception as any).name || 'Error',
    };

    response.status(status).json(errorResponse);
  }
}
