import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

describe('AgentController', () => {
  let controller: AgentController;

  // AgentService 的 streamAgentChat 是 AsyncGenerator，用 jest.fn() 返回异步生成器函数
  const mockAgentService = {
    streamAgentChat: jest.fn(),
  };

  // 构造标准 Mock Response 对象
  const buildMockRes = () => ({
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    headersSent: false,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        {
          provide: AgentService,
          useValue: mockAgentService,
        },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
  });

  it('应该成功初始化 AgentController', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // 正常流式输出
  // ─────────────────────────────────────────────
  describe('POST /agent/chat — 正常路径', () => {
    it('应设置正确的 Vercel AI SDK SSE Response Header', async () => {
      const mockRes = buildMockRes();

      // 正确：streamAgentChat 是 AsyncGenerator，直接返回生成器（不包装在 Promise 中）
      mockAgentService.streamAgentChat.mockReturnValue(
        (async function* () {
          yield '你好';
        })(),
      );

      await controller.chat({ messages: [{ role: 'user', content: '你好' }] }, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Vercel-AI-Data-Stream', 'v1');
    });

    it('应将每个 Token 以 Vercel AI SDK 数据帧格式 0:"text"\\n 写入 Response', async () => {
      const mockRes = buildMockRes();

      mockAgentService.streamAgentChat.mockReturnValue(
        (async function* () {
          yield '你好';
          yield '，世界！';
          yield ' 这是第三段。';
        })(),
      );

      await controller.chat({ messages: [{ role: 'user', content: '你好' }] }, mockRes as any);

      expect(mockRes.write).toHaveBeenCalledTimes(3);
      expect(mockRes.write).toHaveBeenNthCalledWith(1, `0:${JSON.stringify('你好')}\n`);
      expect(mockRes.write).toHaveBeenNthCalledWith(2, `0:${JSON.stringify('，世界！')}\n`);
      expect(mockRes.write).toHaveBeenNthCalledWith(3, `0:${JSON.stringify(' 这是第三段。')}\n`);
      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });

    it('空字符串 Token 不应被写入 Response（过滤空片段）', async () => {
      const mockRes = buildMockRes();

      mockAgentService.streamAgentChat.mockReturnValue(
        (async function* () {
          yield '有内容';
          yield '';          // 空串，应被过滤
          yield '继续输出';
        })(),
      );

      await controller.chat({ messages: [{ role: 'user', content: '测试' }] }, mockRes as any);

      // 只应写入非空的 2 次
      expect(mockRes.write).toHaveBeenCalledTimes(2);
      expect(mockRes.write).toHaveBeenCalledWith(`0:${JSON.stringify('有内容')}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(`0:${JSON.stringify('继续输出')}\n`);
    });

    it('messages 为空数组时也应正常调用 AgentService 并结束响应', async () => {
      const mockRes = buildMockRes();

      mockAgentService.streamAgentChat.mockReturnValue(
        (async function* () {
          yield '我是助手';
        })(),
      );

      await controller.chat({ messages: [] }, mockRes as any);

      expect(mockAgentService.streamAgentChat).toHaveBeenCalledWith([]);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('body.messages 未提供时应默认使用空数组调用 AgentService', async () => {
      const mockRes = buildMockRes();

      mockAgentService.streamAgentChat.mockReturnValue(
        (async function* () {})(),
      );

      // 传入不含 messages 的 body
      await controller.chat({} as any, mockRes as any);

      expect(mockAgentService.streamAgentChat).toHaveBeenCalledWith([]);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // 异常处理路径
  // ─────────────────────────────────────────────
  describe('POST /agent/chat — 异常路径', () => {
    it('AgentService 抛出异常且 Header 未发送时，应返回 HTTP 500', async () => {
      const mockRes = buildMockRes();

      mockAgentService.streamAgentChat.mockImplementation(() => {
        throw new Error('LLM 服务不可用');
      });

      await controller.chat({ messages: [{ role: 'user', content: '测试' }] }, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'LLM 服务不可用' });
      // 异常时不应调用 write
      expect(mockRes.write).not.toHaveBeenCalled();
    });

    it('流式过程中途抛出异常且 Header 已发送时，应直接 end 而非 json 响应', async () => {
      const mockRes = {
        ...buildMockRes(),
        headersSent: true, // 模拟 Header 已经发送
      };

      mockAgentService.streamAgentChat.mockReturnValue(
        (async function* () {
          yield '第一段';
          throw new Error('中途流中断');
        })(),
      );

      await controller.chat({ messages: [{ role: 'user', content: '测试' }] }, mockRes as any);

      // headersSent = true，应调用 end 而不是 json
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
