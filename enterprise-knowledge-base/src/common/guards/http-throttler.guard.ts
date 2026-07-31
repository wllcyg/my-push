import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * 专门针对 HTTP 请求的限流防护 Guard
 * 自动识别并跳过 RabbitMQ / RPC / WebSocket 等非 HTTP 消息上下文，
 * 彻底防止 ThrottlerGuard 尝试在 MQ 消息上调用 res.header 导致的 TypeError 崩溃
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    return super.canActivate(context);
  }
}
