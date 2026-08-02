import { Logger } from '@nestjs/common';
import { CallbackHandler } from 'langfuse-langchain';

export interface TraceAgentOptions {
  name?: string;
  tags?: string[];
}

/**
 * @TraceAgent() 自定义切面装饰器
 * 自动拦截 Agent 方法调用，创建 Langfuse CallbackHandler 并自动做 Trace 的异步 Flush
 */
export function TraceAgent(options?: TraceAgentOptions) {
  const logger = new Logger('TraceAgentDecorator');

  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function* (...args: any[]) {
      const publicKey =
        process.env.LANGFUSE_PUBLIC_KEY ||
        (this as any)?.configService?.get('LANGFUSE_PUBLIC_KEY') ||
        (this as any)?.langfuseService?.configService?.get('LANGFUSE_PUBLIC_KEY');

      const secretKey =
        process.env.LANGFUSE_SECRET_KEY ||
        (this as any)?.configService?.get('LANGFUSE_SECRET_KEY') ||
        (this as any)?.langfuseService?.configService?.get('LANGFUSE_SECRET_KEY');

      const host =
        process.env.LANGFUSE_BASE_URL ||
        process.env.LANGFUSE_HOST ||
        process.env.LANGFUSE_BASEURL ||
        (this as any)?.configService?.get('LANGFUSE_BASE_URL') ||
        (this as any)?.configService?.get('LANGFUSE_HOST');

      let handler: CallbackHandler | null = null;

      if (publicKey && secretKey) {
        try {
          handler = new CallbackHandler({
            publicKey,
            secretKey,
            baseUrl: host,
            tags: options?.tags || [options?.name || propertyKey],
          });
          logger.log(
            `🔍 [Langfuse Trace] 成功检测到密钥，已针对 Agent [${options?.name || propertyKey}] 启动 Tracing 跟踪`,
          );
        } catch (err) {
          logger.warn(`⚠️ [Langfuse Trace] 初始化 Handler 失败: ${(err as Error).message}`);
        }
      } else {
        logger.warn(
          `⚠️ [Langfuse Trace] 未能在 process.env 中找到 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY，请检查 Infisical 远端配置`,
        );
      }

      // 提取/构建用于透传给 LangGraph 的 traceConfig 结构
      const traceConfig = handler ? { callbacks: [handler] } : { callbacks: [] };

      try {
        // 执行原始 AsyncGenerator 函数
        yield* originalMethod.call(this, ...args, traceConfig);
      } finally {
        if (handler) {
          await handler.flushAsync();
          logger.log(`✅ [Langfuse Trace] Trace 日志已成功刷新上报 (Flush)`);
        }
      }
    };

    return descriptor;
  };
}
