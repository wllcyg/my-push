import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { CompiledStateGraph } from '@langchain/langgraph';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AGENT_TOOLS, AGENT_MODEL_CONFIG } from './agent.constants';
import { LlmService } from '../llm/llm.service';
import { LangfuseService } from '../langfuse/langfuse.service';
import { RedisMessageStoreService } from './services/redis-message-store.service';
import { ChatHistoryService } from './services/chat-history.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { SkillRegistryService } from './services/skill-registry.service';
import { SemanticFewShotService } from './services/semantic-few-shot.service';
import { buildCompiledAgentWorkflow } from './agent-workflow.builder';
import { buildFormattedMessages } from './agent-chat-context.builder';
import { createAgentResponseStream } from './agent-stream.generator';
import { SESSION_DEPENDENT_QUERY_REGEX } from './agent.utils';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private mainLlm: ChatOpenAI;
  private fastLlm: ChatOpenAI;
  private classifierLlm: ChatOpenAI;

  /** 模块初始化后编译一次，全生命周期复用 */
  private compiledApp: CompiledStateGraph<any, any, any>;

  constructor(
    private readonly llmService: LlmService,
    private readonly langfuseService: LangfuseService,
    private readonly redisStoreService: RedisMessageStoreService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly semanticCacheService: SemanticCacheService,
    private readonly skillRegistryService: SkillRegistryService,
    private readonly semanticFewShotService: SemanticFewShotService,
    @Inject(AGENT_TOOLS) private readonly tools: DynamicStructuredTool[],
  ) {
    this.mainLlm = this.llmService.createChatModel({
      modelName: AGENT_MODEL_CONFIG.MAIN_MODEL_NAME,
      temperature: 0.2,
      streaming: true,
    });

    this.fastLlm = this.llmService.createChatModel({
      modelName: AGENT_MODEL_CONFIG.FAST_MODEL_NAME,
      temperature: 0.1,
      streaming: true,
    });

    this.classifierLlm = this.llmService.createChatModel({
      modelName: AGENT_MODEL_CONFIG.CLASSIFIER_MODEL_NAME,
      temperature: 0,
      streaming: false,
    });
  }

  /**
   * NestJS 生命周期钩子：模块初始化完成后执行一次 workflow 编译
   * 后续所有请求复用同一个 compiledApp 实例，避免重复构建 StateGraph
   */
  onModuleInit() {
    this.logger.log(
      `⚙️  [LangGraph] 初始化并编译 Agent StateGraph (解耦加载 ${this.tools.length} 个 Module 工具)...`,
    );

    this.compiledApp = buildCompiledAgentWorkflow({
      mainLlm: this.mainLlm,
      fastLlm: this.fastLlm,
      classifierLlm: this.classifierLlm,
      tools: this.tools,
      logger: this.logger,
    });

    this.logger.log(
      '✅ [LangGraph] 意图路由 Agent StateGraph 编译完成，已就绪',
    );
  }

  /**
   * 智能 Agent 问答流 (基于 LangGraph StateGraph 状态图引擎驱动)
   * 支持后端 Redis 短期记忆与 Supabase PostgreSQL 长期持久化
   */
  async streamAgentChat(
    rawMessages: Array<{ role: string; content: string }>,
    inputSessionId?: string,
  ): Promise<{ textStream: AsyncGenerator<string>; sessionId: string }> {
    const activeSessionId =
      inputSessionId && inputSessionId.trim() !== ''
        ? inputSessionId.trim()
        : `session_${crypto.randomUUID()}`;

    const lastUserMsg = [...rawMessages]
      .reverse()
      .find((m) => m?.role === 'user');
    const userQuery = lastUserMsg?.content || '你好';

    this.logger.log(
      `🚀 [LangGraph] 收到问答请求 (Session: ${activeSessionId})`,
    );

    const redisHistory =
      await this.redisStoreService.loadMessages(activeSessionId);

    const isSessionDependentQuery =
      redisHistory.length > 0 ||
      rawMessages.length > 1 ||
      SESSION_DEPENDENT_QUERY_REGEX.test(userQuery.trim());

    if (!isSessionDependentQuery) {
      const semanticCachedAnswer =
        await this.semanticCacheService.getMatchedCache(userQuery);
      if (semanticCachedAnswer) {
        const fastStream = async function* () {
          await Promise.resolve();
          yield semanticCachedAnswer;
        };

        this.chatHistoryService
          .appendMessage(activeSessionId, 'user', userQuery)
          .catch(() => {});
        this.chatHistoryService
          .appendMessage(activeSessionId, 'assistant', semanticCachedAnswer)
          .catch(() => {});

        return {
          textStream: fastStream(),
          sessionId: activeSessionId,
        };
      }
    }

    const traceBundle = this.langfuseService.createTraceBundle({
      name: 'agent-chat',
      sessionId: activeSessionId,
      tags: ['LangGraph', 'RAG_Agent'],
      input: { query: userQuery, redisHistoryCount: redisHistory.length },
    });

    if (!traceBundle) {
      this.logger.warn(
        '⚠️ [Langfuse Trace] 未能初始化 Trace Bundle，跳过 Tracing 上报',
      );
    }

    const skillManifest = this.skillRegistryService.getSkillManifestPrompt();
    const matchedSkills =
      this.skillRegistryService.getMatchedSkillBodies(userQuery);

    // 动态搜索匹配的 Semantic Few-Shot 少样本示范
    const fewShotMessages =
      this.semanticFewShotService.buildFewShotMessages(userQuery);

    const formattedMessages: BaseMessage[] = buildFormattedMessages({
      userQuery,
      rawMessages,
      redisHistory,
      skillManifest,
      matchedSkills,
      fewShotMessages,
    });

    if (rawMessages.length <= 1 && redisHistory.length > 0) {
      this.logger.log(
        `🧠 [AgentMemory] 成功从 Redis 加载 ${redisHistory.length} 条历史对话`,
      );
    }

    return {
      textStream: createAgentResponseStream({
        compiledApp: this.compiledApp,
        logger: this.logger,
        formattedMessages,
        traceBundle,
        activeSessionId,
        userQuery,
        isSessionDependentQuery,
        redisStoreService: this.redisStoreService,
        chatHistoryService: this.chatHistoryService,
        semanticCacheService: this.semanticCacheService,
      }),
      sessionId: activeSessionId,
    };
  }
}
