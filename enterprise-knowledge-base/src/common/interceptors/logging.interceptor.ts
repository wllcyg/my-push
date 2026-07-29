import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 忽略非 HTTP 上下文（如 RabbitMQ 消息消费 / RPC 调用的情况）
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, ip } = request;
    const userAgent = typeof request?.get === 'function' ? request.get('user-agent') || '' : '';
    const traceId = crypto.randomUUID().slice(0, 8);
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            {
              message: `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
              traceId,
              method,
              url: originalUrl,
              statusCode,
              duration,
              ip,
              userAgent,
            },
            'HTTP',
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error(
            {
              message: `${method} ${originalUrl} ${statusCode} - ${duration}ms [Error: ${error.message}]`,
              traceId,
              method,
              url: originalUrl,
              statusCode,
              duration,
              ip,
              userAgent,
            },
            error.stack,
            'HTTP',
          );
        },
      }),
    );
  }
}
