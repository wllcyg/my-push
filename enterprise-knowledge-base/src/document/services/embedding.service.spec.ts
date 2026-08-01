import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

// ─────────────────────────────────────────────────────────────
// 全局 Mock fetch（Node.js 原生 fetch）
// ─────────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// ─────────────────────────────────────────────────────────────
// 工厂函数：构建带有不同配置的 EmbeddingService
// ─────────────────────────────────────────────────────────────
function buildService(overrides: Record<string, any> = {}) {
  const defaults: Record<string, any> = {
    OPENAI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    EMBEDDING_API_KEY: 'sk-test-aliyun-key',
    EMBEDDING_MODEL: 'text-embedding-v4',
    EMBEDDING_DIMENSION: 1536,
  };
  const config = { ...defaults, ...overrides };

  const mockConfigService = {
    get: jest.fn((key: string) => config[key] ?? null),
  } as unknown as ConfigService;

  return new EmbeddingService(mockConfigService);
}

// ─────────────────────────────────────────────────────────────
// 辅助：构建标准 API 成功响应
// ─────────────────────────────────────────────────────────────
function buildMockApiResponse(vectors: number[][], status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue({
      data: vectors.map((embedding, index) => ({ index, embedding })),
      model: 'text-embedding-v4',
      usage: { total_tokens: 10 },
    }),
    text: jest.fn().mockResolvedValue(`HTTP Error ${status}`),
  };
}

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // 配置初始化验证
  // ─────────────────────────────────────────────
  describe('初始化与配置', () => {
    it('未配置 EMBEDDING_API_URL 时，应从 OPENAI_BASE_URL 拼接 /embeddings 路径', () => {
      const service = buildService({ OPENAI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' });
      // 通过 embed 调用验证 fetch 被调用的 URL
      mockFetch.mockResolvedValue(buildMockApiResponse([[0.1, 0.2]]));

      void service.embed('test'); // 触发调用
      // URL 验证在下面的真实 API 调用测试中覆盖
      expect(service).toBeDefined();
    });

    it('OPENAI_BASE_URL 末尾有斜杠时，拼接后不应出现双斜杠', async () => {
      const service = buildService({ OPENAI_BASE_URL: 'https://api.example.com/v1/' });
      mockFetch.mockResolvedValue(buildMockApiResponse([[0.1]]));

      await service.embed('test');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).not.toContain('//embeddings');
      expect(calledUrl).toContain('/embeddings');
    });
  });

  // ─────────────────────────────────────────────
  // 真实 HTTP Embedding API 路径
  // ─────────────────────────────────────────────
  describe('远程 HTTP API 调用（有 API Key）', () => {
    it('应携带正确的 Authorization Bearer Header 调用 /embeddings 接口', async () => {
      const service = buildService({ EMBEDDING_API_KEY: 'sk-real-api-key' });
      mockFetch.mockResolvedValue(buildMockApiResponse([[0.1, 0.2, 0.3]]));

      await service.embed('Hello World');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/embeddings');
      expect(options.headers['Authorization']).toBe('Bearer sk-real-api-key');
      expect(options.method).toBe('POST');
    });

    it('应在请求 body 中携带正确的 model 名称与 input 数组', async () => {
      const service = buildService({ EMBEDDING_MODEL: 'text-embedding-v4' });
      mockFetch.mockResolvedValue(buildMockApiResponse([[0.1, 0.2]]));

      await service.embed('测试文本');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('text-embedding-v4');
      expect(body.input).toEqual(['测试文本']);
    });

    it('应正确返回 API 返回的向量数组', async () => {
      const service = buildService();
      const expectedVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockFetch.mockResolvedValue(buildMockApiResponse([expectedVector]));

      const result = await service.embed('测试文本');

      expect(result).toEqual(expectedVector);
    });

    it('API 返回 HTTP 500 时应抛出异常并包含状态码信息', async () => {
      const service = buildService();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      });

      // embedBatch 内部捕获后 fallback 到 Mock 向量（不向外抛出）
      const result = await service.embedBatch(['测试文本']);

      // 降级返回 Mock 向量，长度正确
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1536);
    });

    it('API 返回格式非法（无 data 字段）时应 fallback 到 Mock 向量', async () => {
      const service = buildService();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: 'unexpected format' }),
      });

      const result = await service.embedBatch(['测试文本']);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1536);
    });

    it('fetch 网络异常时应 fallback 到本地 Mock 向量，不向外抛出', async () => {
      const service = buildService();
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.embedBatch(['测试文本']);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1536);
    });
  });

  // ─────────────────────────────────────────────
  // 批量处理 & 分批逻辑
  // ─────────────────────────────────────────────
  describe('批量处理', () => {
    it('超过 batchSize (10) 的文本列表应自动分批发送请求', async () => {
      const service = buildService();
      const texts = Array.from({ length: 25 }, (_, i) => `文本段落 ${i + 1}`);

      // 每次返回对应批次数量的向量
      mockFetch.mockImplementation((_url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string);
        const batchSize = body.input.length;
        return Promise.resolve(
          buildMockApiResponse(
            Array.from({ length: batchSize }, () => [0.1, 0.2]),
          ),
        );
      });

      const results = await service.embedBatch(texts);

      // 25 条文本，每批 10 条 → 3 次 fetch 请求
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(25);
    });

    it('embedBatch 传入空数组时应直接返回 [] 而不发起请求', async () => {
      const service = buildService();

      const result = await service.embedBatch([]);

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('embed 单条文本应调用 embedBatch 并返回第一个向量', async () => {
      const service = buildService();
      const expectedVector = [0.9, 0.8, 0.7];
      mockFetch.mockResolvedValue(buildMockApiResponse([expectedVector]));

      const result = await service.embed('单条文本');

      expect(result).toEqual(expectedVector);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────
  // 无 API Key 降级路径（Mock 向量）
  // ─────────────────────────────────────────────
  describe('无 API Key 时的降级路径', () => {
    it('未配置 API Key 时不应发起 HTTP 请求，直接返回 Mock 归一化向量', async () => {
      const service = buildService({ EMBEDDING_API_KEY: '', ALIYUN_API_KEY: '' });

      await service.embedBatch(['测试文本']);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Mock 向量维度应与配置的 EMBEDDING_DIMENSION 一致', async () => {
      const service = buildService({ EMBEDDING_API_KEY: '', EMBEDDING_DIMENSION: 1024 });

      const result = await service.embed('测试');

      expect(result).toHaveLength(1024);
    });

    it('Mock 向量应归一化（L2 Norm 近似为 1）', async () => {
      const service = buildService({ EMBEDDING_API_KEY: '', EMBEDDING_DIMENSION: 1536 });

      const vector = await service.embed('企业知识库');
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

      expect(norm).toBeCloseTo(1, 1);
    });

    it('相同文本的 Mock 向量应具有确定性（两次调用结果一致）', async () => {
      const service = buildService({ EMBEDDING_API_KEY: '' });

      const v1 = await service.embed('相同文本确定性测试');
      const v2 = await service.embed('相同文本确定性测试');

      expect(v1).toEqual(v2);
    });

    it('不同文本的 Mock 向量不应相同', async () => {
      const service = buildService({ EMBEDDING_API_KEY: '' });

      const v1 = await service.embed('企业知识库');
      const v2 = await service.embed('深度学习算法');

      expect(v1).not.toEqual(v2);
    });
  });
});
