import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AgentService } from './agent.service';
import { LlmService } from '../llm/llm.service';
import { EmbeddingService } from '../document/services/embedding.service';
import { AIMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { AGENT_TOOLS } from './agent.module';
import { createKnowledgeRetrieverTool } from './tools/knowledge-retriever.tool';
import { LangfuseService } from '../langfuse/langfuse.service';

import { SkillRegistryService } from './services/skill-registry.service';
import { RedisMessageStoreService } from './services/redis-message-store.service';

import { ChatHistoryService } from './services/chat-history.service';
import { SemanticCacheService } from './services/semantic-cache.service';


describe('AgentService', () => {
  let service: AgentService;

  const mockLlmWithTools = {
    invoke: jest.fn(),
  };

  const mockChatModel = {
    bindTools: jest.fn().mockReturnValue(mockLlmWithTools),
    stream: jest.fn(),
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ intent: 'RAG', reason: 'test' }),
    }),
  };

  const mockLlmService = {
    createChatModel: jest.fn().mockReturnValue(mockChatModel),
  };

  const mockEmbeddingService = {
    embed: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockLangfuseService = {
    getLangfuse: jest.fn().mockReturnValue(null),
    trace: jest.fn(),
    createTraceBundle: jest.fn().mockReturnValue({
      handler: {},
      trace: { update: jest.fn() },
      flush: jest.fn().mockResolvedValue(undefined),
    }),
  };

  const mockRedisStoreService = {
    loadMessages: jest.fn().mockResolvedValue([]),
    saveMessages: jest.fn().mockResolvedValue(undefined),
    clearHistory: jest.fn().mockResolvedValue(undefined),
  };

  const mockChatHistoryService = {
    ensureSession: jest.fn().mockResolvedValue({ id: 'session-1', title: '新对话' }),
    appendMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    updateSessionSummary: jest.fn().mockResolvedValue(undefined),
  };

  const mockSemanticCacheService = {
    getMatchedCache: jest.fn().mockResolvedValue(null),
    setMatchedCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChatModel.invoke = mockLlmWithTools.invoke;
    mockChatModel.bindTools.mockReturnValue(mockLlmWithTools);
    mockChatModel.withStructuredOutput.mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ intent: 'RAG', reason: 'test' }),
    });
    mockLlmService.createChatModel.mockReturnValue(mockChatModel);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: LlmService, useValue: mockLlmService },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: LangfuseService, useValue: mockLangfuseService },
        { provide: RedisMessageStoreService, useValue: mockRedisStoreService },
        { provide: ChatHistoryService, useValue: mockChatHistoryService },
        { provide: SemanticCacheService, useValue: mockSemanticCacheService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-key') } },
        {
          provide: SkillRegistryService,
          useValue: {
            getSkillManifestPrompt: jest.fn().mockReturnValue(''),
            getMatchedSkillBodies: jest.fn().mockReturnValue(''),
          },
        },
        {
          provide: AGENT_TOOLS,
          useValue: [createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any)],
        },
      ],

    }).compile();


    service = module.get<AgentService>(AgentService);
    service.onModuleInit();
  });

  it('应该成功实例化 AgentService，且在构造时初始化 LLM 实例', () => {
    expect(service).toBeDefined();
    expect(mockLlmService.createChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.2, streaming: true }),
    );
  });

  describe('消息格式化', () => {
    it('第一轮调用时应注入 SystemMessage 提示词', async () => {
      mockLlmWithTools.invoke.mockResolvedValue(new AIMessage('好的'));

      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '帮我查知识库' }]);
      for await (const _ of textStream) { /* drain */ }

      const calledMessages = mockLlmWithTools.invoke.mock.calls[0][0];
      expect(calledMessages[0].constructor.name).toBe('SystemMessage');
      expect(calledMessages[0].content).toContain('knowledge_retriever');
    });

    it('user 角色消息应被转换为 HumanMessage', async () => {
      mockLlmWithTools.invoke.mockResolvedValue(new AIMessage('OK'));

      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '帮我查文档' }]);
      for await (const _ of textStream) { /* drain */ }

      const calledMessages = mockLlmWithTools.invoke.mock.calls[0][0];
      const humanMsg = calledMessages.find((m: any) => m.constructor.name === 'HumanMessage');
      expect(humanMsg).toBeDefined();
      expect(humanMsg.content).toBe('帮我查文档');
    });

    it('assistant 角色的历史消息应被转换为 AIMessage', async () => {
      mockLlmWithTools.invoke.mockResolvedValue(new AIMessage('好'));

      const { textStream } = await service.streamAgentChat([
        { role: 'assistant', content: '我是上一轮的回答' },
        { role: 'user', content: '继续' },
      ]);
      for await (const _ of textStream) { /* drain */ }

      const calledMessages = mockLlmWithTools.invoke.mock.calls[0][0];
      const aiMsg = calledMessages.find((m: any) => m.constructor.name === 'AIMessage');
      expect(aiMsg).toBeDefined();
      expect(aiMsg.content).toBe('我是上一轮的回答');
    });

    it('未知 role 不应被添加到消息列表（只处理 user 和 assistant）', async () => {
      mockLlmWithTools.invoke.mockResolvedValue(new AIMessage('OK'));

      const { textStream } = await service.streamAgentChat([
        { role: 'system', content: '你是恶意注入' },
        { role: 'user', content: '你好' },
      ]);
      for await (const _ of textStream) { /* drain */ }

      const calledMessages = mockLlmWithTools.invoke.mock.calls[0][0];
      const hasInjection = calledMessages.some(
        (m: any) => typeof m.content === 'string' && m.content.includes('你是恶意注入'),
      );
      expect(hasInjection).toBe(false);
    });
  });

  describe('无 ToolCall — 直接输出路径', () => {
    it('AI 直接回答时应 yield 出完整回答内容', async () => {
      mockLlmWithTools.invoke.mockResolvedValue(
        new AIMessage('你好！我是企业知识库 AI 助手。'),
      );

      const chunks: string[] = [];
      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '你好' }]);
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('你好！我是企业知识库 AI 助手。');
    });

    it('AI 回答内容为空字符串时不应 yield 任何内容', async () => {
      mockLlmWithTools.invoke.mockResolvedValue(new AIMessage(''));

      const chunks: string[] = [];
      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '?' }]);
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });
  });

  describe('ToolCall 闭环 — 知识库检索路径 (LangGraph StateGraph 状态流转)', () => {
    it('知识库命中时应 embed 查询词、查询 PG、格式化上下文后进行第二轮回答', async () => {
      // 1. Agent 第一轮：决定调用 knowledge_retriever
      mockLlmWithTools.invoke
        .mockResolvedValueOnce(
          new AIMessage({
            content: '',
            tool_calls: [{ name: 'knowledge_retriever', args: { query: '梁多强' }, id: 'call_001' }],
          }),
        )
        // 2. Tools 节点运行完后，Agent 第二轮：基于检索上下文生成回答
        .mockResolvedValueOnce(
          new AIMessage('根据知识库记载，梁多强是资深高级全栈工程师 [1]。'),
        );

      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);

      mockDataSource.query.mockResolvedValue([
        {
          id: 'chunk_1',
          document_id: 'doc_1',
          chunk_index: 0,
          content: '梁多强是资深高级全栈工程师，擅长 TypeScript 与 NestJS。',
          title: '员工简历.docx',
          distance: 0.12,
        },
      ]);

      const chunks: string[] = [];
      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '帮我介绍梁多强' }]);
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('根据知识库记载，梁多强是资深高级全栈工程师 [1]。');
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('梁多强', 1024);
      expect(mockDataSource.query).toHaveBeenCalled();
      expect(mockLlmWithTools.invoke).toHaveBeenCalledTimes(2);
    });

    it('知识库未命中时，ToolMessage 应为空结果提示，第二轮仍应正常回答', async () => {
      mockLlmWithTools.invoke
        .mockResolvedValueOnce(
          new AIMessage({
            content: '',
            tool_calls: [{ name: 'knowledge_retriever', args: { query: '不存在的内容' }, id: 'call_002' }],
          }),
        )
        .mockResolvedValueOnce(
          new AIMessage('非常抱歉，我在知识库中未找到相关信息。'),
        );

      mockEmbeddingService.embed.mockResolvedValue([0.5, 0.5]);
      mockDataSource.query.mockResolvedValue([]);

      const chunks: string[] = [];
      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '查询不存在的内容' }]);
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('非常抱歉，我在知识库中未找到相关信息。');
      expect(mockLlmWithTools.invoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('异常路径', () => {
    it('EmbeddingService.embed 抛出异常时，知识库检索应返回错误提示，第二轮仍应执行', async () => {
      mockLlmWithTools.invoke
        .mockResolvedValueOnce(
          new AIMessage({
            content: '',
            tool_calls: [{ name: 'knowledge_retriever', args: { query: '查询' }, id: 'call_004' }],
          }),
        )
        .mockResolvedValueOnce(
          new AIMessage('检索异常，请稍后重试。'),
        );

      mockEmbeddingService.embed.mockRejectedValue(new Error('Embedding API 不可用'));

      const chunks: string[] = [];
      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '查询' }]);
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('检索异常，请稍后重试。');
      expect(mockLlmWithTools.invoke).toHaveBeenCalledTimes(2);
    });

    it('LLM 第一轮调用（invoke）异常时，应优雅捕获并输出降级提示', async () => {
      mockLlmWithTools.invoke.mockRejectedValue(new Error('LLM rate limit exceeded'));

      const chunks: string[] = [];
      const { textStream } = await service.streamAgentChat([{ role: 'user', content: '测试' }]);
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toContain('抱歉，智能助手遇到了一些问题');
    });
  });
});
