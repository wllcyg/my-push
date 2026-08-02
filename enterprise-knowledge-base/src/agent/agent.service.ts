import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, START, END, CompiledStateGraph } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { createKnowledgeRetrieverTool } from './tools/knowledge-retriever.tool';
import { EmbeddingService } from '../document/services/embedding.service';
import { LlmService } from '../llm/llm.service';
import { LangfuseService } from '../langfuse/langfuse.service';

import { RedisMessageStoreService } from './services/redis-message-store.service';
import { ChatHistoryService } from './services/chat-history.service';
import { SemanticCacheService } from './services/semantic-cache.service';

/** 获取格式化当前系统时间 */
function getCurrentTimeFormatted(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}

/** 定义意图分类 Schema */
const IntentSchema = z.object({
  intent: z
    .enum(['RAG', 'DIRECT'])
    .describe(
      'RAG: 当用户询问具体技术细节、企业业务流程、文档规范、简历或产品内容时选择;\n' +
      'DIRECT: 当用户仅为日常打招呼(你好/Hi)、表示感谢、询问助手是谁、询问当前时间/日期、要求写通用无关代码或闲聊时选择。',
    ),
  reason: z.string().optional().describe('分类原因简述'),
});

/** 定义 LangGraph Agent 对话状态结构 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  intent: Annotation<'RAG' | 'DIRECT'>({
    reducer: (x, y) => y ?? x,
    default: () => 'RAG',
  }),
});

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private mainLlm: ChatOpenAI;
  private classifierLlm: ChatOpenAI;

  /** 模块初始化后编译一次，全生命周期复用 */
  private compiledApp: CompiledStateGraph<any, any, any>;

  constructor(
    private readonly llmService: LlmService,
    private readonly embeddingService: EmbeddingService,
    private readonly dataSource: DataSource,
    private readonly langfuseService: LangfuseService,
    private readonly redisStoreService: RedisMessageStoreService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly semanticCacheService: SemanticCacheService,
  ) {
    // 主推理模型（默认采用配置好的主模型，如 qwen3.6-plus / qwen-max）
    this.mainLlm = this.llmService.createChatModel({
      temperature: 0.2,
      streaming: true,
    });

    // 轻量路由模型（采用 qwen-turbo，低延迟极速分类）
    this.classifierLlm = this.llmService.createChatModel({
      modelName: 'qwen-turbo',
      temperature: 0,
      streaming: false,
    });
  }

  /**
   * NestJS 生命周期钩子：模块初始化完成后执行一次 workflow 编译
   * 后续所有请求复用同一个 compiledApp 实例，避免重复构建 StateGraph
   */
  onModuleInit() {
    this.logger.log('⚙️  [LangGraph] 初始化并编译 Agent StateGraph (含轻量意图分类路由)...');

    // 工具与 LLM 绑定（embeddingService / dataSource 均为单例，可安全复用）
    const retrieverTool = createKnowledgeRetrieverTool(
      this.embeddingService,
      this.dataSource,
    );
    const llmWithTools = this.mainLlm.bindTools([retrieverTool]);

    // 1. 意图分类节点（传入 config 确保 Langfuse callbacks 成功深入透传）
    const intentNode = async (
      state: typeof AgentState.State,
      config?: RunnableConfig,
    ) => {
      // 获取用户发送的最后一条消息
      const lastHumanMsg = [...state.messages].reverse().find((m) => m._getType() === 'human');
      const userQuery = lastHumanMsg ? String(lastHumanMsg.content) : '';

      // 预处理 query：去除首尾空格及末尾常见的语气词和标点
      const normalizedQuery = userQuery.trim().replace(/[？\?！!。，,呢啊呀吗吧]+$/g, '');

      // 极速硬规则正则过滤：对于超短常见的打招呼/时间/感谢词，0 延迟直接判定为 DIRECT
      if (/^(你好|您好|hi|hello|hey|谢谢|感谢|你是谁|自我介绍|再见|bye|今天几号|今天是几号|分析一下今天是几号|几月几号|几点|当前时间|今天星期几)$/i.test(normalizedQuery)) {
        this.logger.log(`🎯 [IntentRouter] 触发硬规则匹配 => DIRECT (免去 LLM 分类)`);
        return { intent: 'DIRECT' as const };
      }

      try {
        const structuredClassifier = this.classifierLlm.withStructuredOutput(IntentSchema, {
          name: 'route_intent',
        });

        const result = await structuredClassifier.invoke(
          [
            new SystemMessage('你是一个专业的企业 AI 助手意图路由分类器。分析用户问题，判定是否需要检索知识库。'),
            new HumanMessage(userQuery || '你好'),
          ],
          config, // 👈 关键点：将 RunnableConfig 透传给 LLM
        );

        this.logger.log(`🎯 [IntentRouter] 识别完成 => 意图: ${result.intent}, 原因: ${result.reason || '无'}`);
        return { intent: result.intent };
      } catch (error) {
        this.logger.warn(`⚠️ [IntentRouter] 意图分类异常，降级默认走 RAG 分支: ${(error as Error).message}`);
        return { intent: 'RAG' as const };
      }
    };

    // 2. RAG 知识库检索思考节点 (透传 config 给底层 llm.invoke)
    const callRagNode = async (
      state: typeof AgentState.State,
      config?: RunnableConfig,
    ) => {
      const response = await llmWithTools.invoke(state.messages, config);
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          this.logger.log(
            `🤖 [LangGraph ToolCall] 触发工具: ${tc.name}, 参数: ${JSON.stringify(tc.args)}`,
          );
        }
      }
      return { messages: [response] };
    };

    // 3. 纯 Chat 直连回答节点 (透传 config 给底层 llm.invoke)
    const callDirectNode = async (
      state: typeof AgentState.State,
      config?: RunnableConfig,
    ) => {
      // 过滤旧的系统提示词，防止提示词重复堆叠并精简输入
      const nonSystemMessages = state.messages.filter((m) => m._getType() !== 'system');
      const directMessages = [
        new SystemMessage(
          '你是一个专业、严谨的企业 AI 智能助手。对于用户的日常打招呼、时间日期询问、感谢或通用问题，请直接礼貌回答，无需使用或提及知识检索工具。\n' +
            `当前系统时间：${getCurrentTimeFormatted()}`,
        ),
        ...nonSystemMessages,
      ];
      const response = await this.mainLlm.invoke(directMessages, config);
      return { messages: [response] };
    };

    // Tools 自动执行节点
    const toolsNode = new ToolNode([retrieverTool]);

    // 构建带路由分支的 LangGraph 状态图
    const workflow = new StateGraph(AgentState)
      .addNode('intent_router', intentNode)
      .addNode('rag_agent', callRagNode)
      .addNode('direct_agent', callDirectNode)
      .addNode('tools', toolsNode)

      // 入口 -> 意图识别节点
      .addEdge(START, 'intent_router')

      // 根据意图选择路由分支
      .addConditionalEdges(
        'intent_router',
        (state) => state.intent,
        {
          RAG: 'rag_agent',
          DIRECT: 'direct_agent',
        },
      )

      // RAG 分支后处理：检查是否有工具调用
      .addConditionalEdges('rag_agent', toolsCondition, {
        tools: 'tools',
        __end__: END,
      })
      .addEdge('tools', 'rag_agent')

      // Direct 分支直接结束
      .addEdge('direct_agent', END);

    this.compiledApp = workflow.compile();
    this.logger.log('✅ [LangGraph] 意图路由 Agent StateGraph 编译完成，已就绪');
  }

  /**
   * 智能 Agent 问答流 (基于 LangGraph StateGraph 状态图引擎驱动)
   * 支持后端 Redis 短期记忆与 Supabase PostgreSQL 长期持久化
   */
  async streamAgentChat(
    rawMessages: Array<{ role: string; content: string }>,
    inputSessionId?: string,
  ): Promise<{ textStream: AsyncGenerator<string>; sessionId: string }> {
    // 后端主导会话 ID 逻辑：未传则由后端自动生成标准 session_xxx，传了则继承
    const activeSessionId =
      inputSessionId && inputSessionId.trim() !== ''
        ? inputSessionId.trim()
        : `session_${crypto.randomUUID()}`;

    // 获取最后一条用户输入的自然语言问题
    const lastUserMsg = [...rawMessages].reverse().find((m) => m?.role === 'user');
    const userQuery = lastUserMsg?.content || '你好';

    this.logger.log(`🚀 [LangGraph] 收到问答请求 (Session: ${activeSessionId})`);

    // 1. 尝试从 Redis 恢复短期记忆历史消息
    const redisHistory = await this.redisStoreService.loadMessages(activeSessionId);

    // 判断当前提问是否属于强依赖上下文/指代的对话（如“我刚才说了什么”、“按第2点修改”等）
    const isSessionDependentQuery =
      redisHistory.length > 0 ||
      rawMessages.length > 1 ||
      /^(我|你|我们|刚才|上一句|上文|第.*点|修改|删|改|叫什么|我是谁)/i.test(userQuery.trim());

    // 仅针对单轮独立且无强上下文依赖的高频提问尝试命中语义缓存
    if (!isSessionDependentQuery) {
      const semanticCachedAnswer = await this.semanticCacheService.getMatchedCache(userQuery);
      if (semanticCachedAnswer) {
        const fastStream = async function* () {
          yield semanticCachedAnswer;
        };
        // 异步记录问答明细到 PostgreSQL 数据库
        this.chatHistoryService.appendMessage(activeSessionId, 'user', userQuery).catch(() => {});
        this.chatHistoryService.appendMessage(activeSessionId, 'assistant', semanticCachedAnswer).catch(() => {});

        return {
          textStream: fastStream(),
          sessionId: activeSessionId,
        };
      }
    }

    // 创建显式 Root Trace 节点
    const traceBundle = this.langfuseService.createTraceBundle({
      name: 'agent-chat',
      sessionId: activeSessionId,
      tags: ['LangGraph', 'RAG_Agent'],
      input: { query: userQuery, redisHistoryCount: redisHistory.length },
    });

    const langfuseHandler = traceBundle?.handler ?? null;

    if (!traceBundle) {
      this.logger.warn('⚠️ [Langfuse Trace] 未能初始化 Trace Bundle，跳过 Tracing 上报');
    }

    // 构建 SystemMessage 头部（100% 保持静态，维护大模型后端 KV Cache 极速命中）
    const systemPromptMessage = new SystemMessage(
      '你是一个专业、严谨的企业知识库 AI 智能助手。你的目标是帮助用户回答技术、业务、文档及员工相关问题。\n' +
        `当前系统时间：${getCurrentTimeFormatted()}\n` +
        '规则：\n' +
        '1. 当用户的问题涉及具体技术、文档规范、简历或业务内容时，你必须且优先调用 `knowledge_retriever` 工具在知识库中进行向量检索。\n' +
        '2. 如果检索到了相关知识切片，请基于切片内容准确作答，并在回答中以 `[1]`、`[2]` 角标标注出处。\n' +
        '3. 若未找到相关信息，请诚实告知用户，不要胡乱编造。',
    );

    const formattedMessages: BaseMessage[] = [systemPromptMessage];

    // 如果前端传了包含历史的完整数组，则优先使用前端格式化的历史
    if (rawMessages.length > 1) {
      for (const msg of rawMessages) {
        if (!msg) continue;
        const textContent = typeof msg.content === 'string' ? msg.content : String(msg.content || '');
        if (!textContent) continue;
        if (msg.role === 'user') {
          formattedMessages.push(new HumanMessage(textContent));
        } else if (msg.role === 'assistant') {
          formattedMessages.push(new AIMessage(textContent));
        }
      }
    } else if (redisHistory.length > 0) {
      // 隐式读取 Redis 短期记忆模式：直接拼接 Redis 中的历史消息 + 当前用户新 Query
      this.logger.log(`🧠 [AgentMemory] 成功从 Redis 加载 ${redisHistory.length} 条历史对话`);
      formattedMessages.push(...redisHistory);
      formattedMessages.push(new HumanMessage(userQuery));
    } else {
      // 首次会话：仅放入当前用户 Query
      formattedMessages.push(new HumanMessage(userQuery));
    }

    const redisService = this.redisStoreService;
    const historyService = this.chatHistoryService;
    const cacheService = this.semanticCacheService;

    // 3. 内部异步生成器
    const generateStream = async function* (compiledApp: any, logger: any) {
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
          const nodeName = meta?.langgraph_node;
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
        logger.error(`❌ [LangGraph] 流式推理失败: ${(error as Error).message}`, (error as Error).stack);
        yield '抱歉，智能助手遇到了一些问题，请稍后重试。';
      } finally {
        if (traceBundle) {
          traceBundle.trace.update({
            output: { answer: fullAnswer || '无输出' },
          });
          await traceBundle.flush();
        }

        // 问答结束写回 Redis 短期记忆 (过滤 SystemMessage)，超过 8 条自动触发 LLM 摘要提炼并回调更新 Supabase 数据库
        const chatOnlyMessages = formattedMessages
          .filter((m) => m._getType() !== 'system')
          .concat(new AIMessage(fullAnswer));

        await redisService.saveMessages(
          activeSessionId,
          chatOnlyMessages,
          8,
          (summaryText) => {
            // 当触发 LLM 摘要时，异步更新 Supabase PostgreSQL 中的会话总结字段
            historyService.updateSessionSummary(activeSessionId, summaryText).catch(() => {});
          },
        );

        // 写回语义缓存（仅针对单轮通用独立提问，7 天 TTL 防爆）
        if (fullAnswer && !isSessionDependentQuery) {
          cacheService.setMatchedCache(userQuery, fullAnswer).catch(() => {});
        }

        // 异步持久化问答明细到 Supabase PostgreSQL (长期记忆)
        historyService.appendMessage(activeSessionId, 'user', userQuery).catch((err) => {
          logger.error(`❌ [ChatHistory] 写入用户消息到 DB 异常: ${err.message}`);
        });
        if (fullAnswer) {
          historyService.appendMessage(activeSessionId, 'assistant', fullAnswer).catch((err) => {
            logger.error(`❌ [ChatHistory] 写入 AI 消息到 DB 异常: ${err.message}`);
          });
        }
      }
    };

    return {
      textStream: generateStream(this.compiledApp, this.logger),
      sessionId: activeSessionId,
    };
  }
}
