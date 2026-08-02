import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, START, END, CompiledStateGraph } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { createKnowledgeRetrieverTool } from '@/agent/tools/knowledge-retriever.tool';
import { EmbeddingService } from '@/document/services/embedding.service';
import { LlmService } from '@/llm/llm.service';
import { LangfuseService } from '@/langfuse/langfuse.service';

/** 定义意图分类 Schema */
const IntentSchema = z.object({
  intent: z
    .enum(['RAG', 'DIRECT'])
    .describe(
      'RAG: 当用户询问具体技术细节、企业业务流程、文档规范、简历或产品内容时选择;\n' +
      'DIRECT: 当用户仅为日常打招呼(你好/Hi)、表示感谢、询问助手是谁、要求写通用无关代码或闲聊时选择。',
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

      // 极速硬规则正则过滤：对于超短常见的打招呼/感谢词，0 延迟直接判定为 DIRECT
      if (/^(你好|您好|hi|hello|hey|谢谢|感谢|你是谁|自我介绍|再见|bye)$/i.test(userQuery.trim())) {
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
      const directMessages = [
        new SystemMessage(
          '你是一个专业、严谨的企业知识库 AI 智能助手。对于用户的日常打招呼、感谢或通用问题，请直接礼貌回答，无需使用或提及知识检索工具。',
        ),
        ...state.messages,
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
   */
  async *streamAgentChat(rawMessages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
    this.logger.log(`🚀 [LangGraph] 收到问答请求，历史对话轮数: ${rawMessages.length}`);

    // 创建该请求专属的 Langfuse Trace Handler
    const langfuseHandler = this.langfuseService.createCallbackHandler({
      tags: ['LangGraph', 'RAG_Agent'],
    });

    if (langfuseHandler) {
      this.logger.log('🔍 [Langfuse Trace] 已成功初始化 Trace CallbackHandler');
    } else {
      this.logger.warn('⚠️ [Langfuse Trace] 未能在环境中找到有效 Key，跳过 Tracing 上报');
    }

    // 1. 转换格式化初始消息
    const formattedMessages: BaseMessage[] = [
      new SystemMessage(
        '你是一个专业、严谨的企业知识库 AI 智能助手。你的目标是帮助用户回答技术、业务、文档及员工相关问题。\n' +
        '规则：\n' +
        '1. 当用户的问题涉及具体技术、文档规范、简历或业务内容时，你必须且优先调用 `knowledge_retriever` 工具在知识库中进行向量检索。\n' +
        '2. 如果检索到了相关知识切片，请基于切片内容准确作答，并在回答中以 `[1]`、`[2]` 角标标注出处。\n' +
        '3. 若未找到相关信息，请诚实告知用户，不要胡乱编造。',
      ),
    ];

    for (const msg of rawMessages) {
      if (!msg) continue;

      let textContent = '';
      if (typeof msg.content === 'string') {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = (msg.content as any[])
          .filter((c: any) => c && (c.type === 'text' || typeof c === 'string'))
          .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
          .join('');
      } else if (Array.isArray((msg as any).parts)) {
        textContent = ((msg as any).parts as any[])
          .filter((p: any) => p && (p.type === 'text' || typeof p === 'string'))
          .map((p: any) => (typeof p === 'string' ? p : p.text || ''))
          .join('');
      }

      if (!textContent) continue;

      if (msg.role === 'user') {
        formattedMessages.push(new HumanMessage(textContent));
      } else if (msg.role === 'assistant') {
        formattedMessages.push(new AIMessage(textContent));
      }
    }

    // 2. 复用已编译的 compiledApp 状态图
    try {
      const stream = await this.compiledApp.stream(
        { messages: formattedMessages },
        {
          streamMode: 'messages',
          recursionLimit: 10, // 防止工具调用死循环
          callbacks: langfuseHandler ? [langfuseHandler] : [],
        },
      );

      for await (const [message, meta] of stream) {
        // 提取 rag_agent 或 direct_agent 节点发出的文本消息
        const nodeName = meta?.langgraph_node;
        if (
          (nodeName === 'rag_agent' || nodeName === 'direct_agent') &&
          message &&
          typeof message.content === 'string'
        ) {
          if (message.content) {
            yield message.content;
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ [LangGraph] 流式推理失败: ${(error as Error).message}`, (error as Error).stack);
      yield '抱歉，智能助手遇到了一些问题，请稍后重试。';
    } finally {
      if (langfuseHandler) {
        try {
          await langfuseHandler.flushAsync();
          this.logger.log('✅ [Langfuse Trace] Trace 上报刷新完毕 (Flush)');
        } catch (flushErr) {
          this.logger.error(
            `❌ [Langfuse Trace] Flush 网络上报失败: ${(flushErr as Error).message}`,
          );
        }
      }
    }
  }
}

