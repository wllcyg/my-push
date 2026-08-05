import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { CompiledStateGraph } from '@langchain/langgraph';
import { Logger } from '@nestjs/common';
import { LangfuseTraceBundle } from '../langfuse/langfuse.service';
import { ChatHistoryService } from './services/chat-history.service';
import { RedisMessageStoreService } from './services/redis-message-store.service';
import { SemanticCacheService } from './services/semantic-cache.service';

export interface CreateAgentStreamOptions {
  compiledApp: CompiledStateGraph<any, any, any>;
  logger: Logger;
  formattedMessages: BaseMessage[];
  traceBundle: LangfuseTraceBundle | null;
  activeSessionId: string;
  userQuery: string;
  isSessionDependentQuery: boolean;
  redisStoreService: RedisMessageStoreService;
  chatHistoryService: ChatHistoryService;
  semanticCacheService: SemanticCacheService;
}

export async function* createAgentResponseStream(
  options: CreateAgentStreamOptions,
): AsyncGenerator<string> {
  const {
    compiledApp,
    logger,
    formattedMessages,
    traceBundle,
    activeSessionId,
    userQuery,
    isSessionDependentQuery,
    redisStoreService,
    chatHistoryService,
    semanticCacheService,
  } = options;

  const langfuseHandler = traceBundle?.handler ?? null;
  let fullAnswer = '';

  try {
    const stream = await compiledApp.stream(
      { messages: formattedMessages },
      {
        streamMode: 'messages',
        recursionLimit: 10,
        callbacks: langfuseHandler ? [langfuseHandler] : [],
      },
    );

    for await (const [message, meta] of stream) {
      const nodeName = (meta as { langgraph_node?: string })?.langgraph_node;
      if (
        (nodeName === 'rag_agent' || nodeName === 'direct_agent') &&
        message &&
        typeof message.content === 'string'
      ) {
        if (message.content) {
          fullAnswer += message.content;
          yield message.content;
        }
      }
    }
  } catch (error) {
    logger.error(
      `❌ [LangGraph] 流式推理失败: ${(error as Error).message}`,
      (error as Error).stack,
    );
    yield '抱歉，智能助手遇到了一些问题，请稍后重试。';
  } finally {
    if (traceBundle) {
      traceBundle.trace.update({
        output: { answer: fullAnswer || '无输出' },
      });
      await traceBundle.flush();
    }

    const chatOnlyMessages = formattedMessages
      .filter((m) => m._getType() !== 'system')
      .concat(new AIMessage(fullAnswer));

    await redisStoreService.saveMessages(
      activeSessionId,
      chatOnlyMessages,
      8,
      (summaryText) => {
        chatHistoryService
          .updateSessionSummary(activeSessionId, summaryText)
          .catch(() => {});
      },
    );

    if (fullAnswer && !isSessionDependentQuery) {
      semanticCacheService
        .setMatchedCache(userQuery, fullAnswer)
        .catch(() => {});
    }

    chatHistoryService
      .appendMessage(activeSessionId, 'user', userQuery)
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`❌ [ChatHistory] 写入用户消息到 DB 异常: ${message}`);
      });

    if (fullAnswer) {
      chatHistoryService
        .appendMessage(activeSessionId, 'assistant', fullAnswer)
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`❌ [ChatHistory] 写入 AI 消息到 DB 异常: ${message}`);
        });
    }
  }
}
