import { Injectable, Logger } from '@nestjs/common';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  StoredMessage,
} from '@langchain/core/messages';
import { RedisService } from '../../redis/redis.service';
import { LlmService } from '../../llm/llm.service';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class RedisMessageStoreService {
  private readonly logger = new Logger(RedisMessageStoreService.name);
  private readonly moduleName = 'short_memory';
  private readonly defaultTtl = 1800; // 30 分钟滑动 TTL
  private readonly memoryFallback = new Map<string, StoredMessage[]>();
  private readonly summarizerLlm: ChatOpenAI;

  constructor(
    private readonly redisService: RedisService,
    private readonly llmService: LlmService,
  ) {
    // 实例化极速低成本的提炼总结模型 qwen-turbo
    this.summarizerLlm = this.llmService.createChatModel({
      modelName: 'qwen-turbo',
      temperature: 0,
      streaming: false,
    });
  }

  /** 从 Redis 加载会话的历史 BaseMessage 列表 */
  async loadMessages(sessionId: string): Promise<BaseMessage[]> {
    if (!sessionId) return [];
    try {
      const stored = await this.redisService.getJson<StoredMessage[]>(this.moduleName, sessionId);
      const rawList = stored || this.memoryFallback.get(sessionId) || [];

      if (!rawList || rawList.length === 0) {
        return [];
      }
      return mapStoredMessagesToChatMessages(rawList);
    } catch (error) {
      this.logger.error(`❌ [RedisMessageStore] 读取会话 ${sessionId} 消息失败: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 将最新对话消息写回 Redis
   * 当消息条数 >= 8 时触发动态 LLM 摘要压缩，提炼较早前文为 50 字以内摘要，保留最近 4 条原始消息
   */
  async saveMessages(
    sessionId: string,
    messages: BaseMessage[],
    maxCountBeforeSummary = 8,
    onSummaryGenerated?: (summaryText: string) => void,
  ): Promise<void> {
    if (!sessionId || !messages || messages.length === 0) return;

    try {
      let finalMessages = [...messages];

      // 当非 system 消息总数 >= 8 条时，触发 LLM 动态上下文摘要压缩
      const nonSystemMsgs = finalMessages.filter((m) => m._getType() !== 'system');
      if (nonSystemMsgs.length >= maxCountBeforeSummary) {
        this.logger.log(`⚡ [RedisMessageStore] 会话 ${sessionId} 消息数 (${nonSystemMsgs.length}) 触达阈值 (${maxCountBeforeSummary})，启动 LLM 动态摘要压缩...`);

        const oldMessagesToSummarize = nonSystemMsgs.slice(0, -4);
        const recentMessagesToKeep = nonSystemMsgs.slice(-4);

        try {
          const summaryResult = await this.summarizerLlm.invoke([
            new SystemMessage('请用中文极简总结以下对话的关键事实、用户要求与核心结论（控制在 50 字以内）：'),
            ...oldMessagesToSummarize,
          ]);

          const summaryText = typeof summaryResult.content === 'string' ? summaryResult.content : String(summaryResult.content || '');
          if (summaryText) {
            const summaryMsg = new SystemMessage(`【前文对话摘要】：${summaryText}`);
            finalMessages = [summaryMsg, ...recentMessagesToKeep];
            this.logger.log(`✅ [RedisMessageStore] 会话 ${sessionId} 摘要生成完成: "${summaryText}"`);

            if (onSummaryGenerated) {
              onSummaryGenerated(summaryText);
            }
          }
        } catch (sumErr) {
          this.logger.warn(`⚠️ [RedisMessageStore] 摘要提炼异常，退回普通滑动截断: ${(sumErr as Error).message}`);
          finalMessages = nonSystemMsgs.slice(-maxCountBeforeSummary);
        }
      }

      const storedMessages = mapChatMessagesToStoredMessages(finalMessages);

      const success = await this.redisService.setJson(
        this.moduleName,
        sessionId,
        storedMessages,
        this.defaultTtl,
      );

      if (!success) {
        this.memoryFallback.set(sessionId, storedMessages);
      } else {
        this.memoryFallback.delete(sessionId);
      }

      this.logger.log(`💾 [RedisMessageStore] 会话 ${sessionId} 已成功缓存 ${finalMessages.length} 条消息到 Redis (TTL ${this.defaultTtl}s)`);
    } catch (error) {
      this.logger.error(`❌ [RedisMessageStore] 保存会话 ${sessionId} 消息失败: ${(error as Error).message}`);
    }
  }

  /** 清空指定会话在 Redis 中的短期记忆 */
  async clear(sessionId: string): Promise<void> {
    if (!sessionId) return;
    await this.redisService.delete(this.moduleName, sessionId);
    this.memoryFallback.delete(sessionId);
    this.logger.log(`🧹 [RedisMessageStore] 已清空会话 ${sessionId} 的 Redis 短期记忆`);
  }
}
