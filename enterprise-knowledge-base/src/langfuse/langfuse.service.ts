import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Langfuse, LangfuseTraceClient } from 'langfuse';
import { CallbackHandler } from 'langfuse-langchain';

export interface CreateTraceOptions {
  name?: string;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  input?: any;
}

export interface LangfuseTraceBundle {
  handler: CallbackHandler;
  trace: LangfuseTraceClient;
  flush: () => Promise<void>;
}

@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name);
  private langfuse: Langfuse | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initClient();
  }

  private initClient() {
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
      return;
    }

    try {
      this.langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl,
        flushAt: 1,
        flushInterval: 1000,
      });
      this.logger.log(`⚙️ [Langfuse] SDK 客户端初始化成功 (${baseUrl || '默认'})`);
    } catch (err) {
      this.logger.error(`❌ [Langfuse] SDK 客户端初始化失败: ${(err as Error).message}`);
    }
  }

  /**
   * 手动创建强绑定的根 Trace，并衍生对应的 LangChain CallbackHandler。
   * 彻底解决 LangGraph 分支无法自动推导根节点导致 Trace 丢失的问题。
   */
  createTraceBundle(options?: CreateTraceOptions): LangfuseTraceBundle | null {
    if (!this.langfuse) {
      return null;
    }

    try {
      // 1. 手动创建强绑定的根节点 Trace（保证云端 100% 存在且可检索）
      const trace = this.langfuse.trace({
        name: options?.name || 'agent-chat',
        sessionId: options?.sessionId,
        userId: options?.userId,
        tags: options?.tags || ['enterprise-knowledge-base', 'LangGraph'],
        metadata: options?.metadata,
        input: options?.input,
      });

      // 2. 将 Root Trace 强绑定给 LangChain CallbackHandler
      const handler = new CallbackHandler({ root: trace });

      this.logger.log(`🔍 [Langfuse Trace] 根节点创建成功: traceId=${trace.id}, sessionId=${options?.sessionId || '未指定'}`);

      return {
        handler,
        trace,
        flush: async () => {
          try {
            await handler.flushAsync();
            await this.langfuse?.flushAsync();
            this.logger.log(`✅ [Langfuse Trace] 根节点 Trace (traceId=${trace.id}) 刷盘成功`);
          } catch (err) {
            this.logger.error(`❌ [Langfuse Trace] Flush 异常: ${(err as Error).message}`);
          }
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ [Langfuse Trace] 创建 Root Trace 失败: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
