import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallbackHandler } from 'langfuse-langchain';

export interface CreateTraceOptions {
  sessionId?: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 创建 LangChain / LangGraph 兼容的 Langfuse CallbackHandler 追踪实例
   */
  createCallbackHandler(options?: CreateTraceOptions): CallbackHandler | null {
    const publicKey =
      this.configService.get<string>('LANGFUSE_PUBLIC_KEY') ||
      process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey =
      this.configService.get<string>('LANGFUSE_SECRET_KEY') ||
      process.env.LANGFUSE_SECRET_KEY;
    const baseUrl =
      this.configService.get<string>('LANGFUSE_BASE_URL') ||
      this.configService.get<string>('LANGFUSE_HOST') ||
      process.env.LANGFUSE_BASE_URL ||
      process.env.LANGFUSE_HOST;

    if (!publicKey || !secretKey) {
      this.logger.warn(
        '⚠️ [Langfuse] 未检测到 LANGFUSE_PUBLIC_KEY 或 LANGFUSE_SECRET_KEY，跳过 Tracing 追踪',
      );
      return null;
    }

    try {
      this.logger.log(`⚙️ [Langfuse] 正在初始化 Trace CallbackHandler (${baseUrl || '默认'})`);
      const handler = new CallbackHandler({
        publicKey,
        secretKey,
        baseUrl,
        sessionId: options?.sessionId,
        userId: options?.userId,
        tags: options?.tags || ['enterprise-knowledge-base'],
        metadata: options?.metadata,
      });
      return handler;
    } catch (error) {
      this.logger.error(
        `❌ [Langfuse] CallbackHandler 初始化失败: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
