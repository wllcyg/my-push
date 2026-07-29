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

    // 结构化打印异常日志
    this.logger.error(
      `Unhandled Exception: ${request.method} ${request.url} [Status: ${status}]`,
      stack,
      {
        path: request.url,
        method: request.method,
        statusCode: status,
        message,
        ip: request.ip,
      },
    );

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
