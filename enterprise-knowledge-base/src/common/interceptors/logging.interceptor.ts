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
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const traceId = crypto.randomUUID().slice(0, 8);
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
            {
              traceId,
              method,
              url: originalUrl,
              statusCode,
              duration,
              ip,
              userAgent,
            },
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error(
            `${method} ${originalUrl} ${statusCode} - ${duration}ms [Error: ${error.message}]`,
            error.stack,
            {
              traceId,
              method,
              url: originalUrl,
              statusCode,
              duration,
              ip,
              userAgent,
            },
          );
        },
      }),
    );
  }
}
