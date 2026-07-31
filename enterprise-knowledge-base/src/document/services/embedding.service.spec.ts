import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'EMBEDDING_DIMENSION') return 1536;
        if (key === 'EMBEDDING_API_KEY') return '';
        return null;
      }),
    };
    service = new EmbeddingService(mockConfigService as ConfigService);
  });

  it('未配置 API Key 时应该生成正确维度的 Mock 归一化向量', async () => {
    const text = '测试文本切片向量化';
    const vector = await service.embed(text);

    expect(vector).toHaveLength(1536);
    expect(typeof vector[0]).toBe('number');

    // 验证向量 L2 Norm 模长近似为 1 (归一化)
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 1);
  });

  it('批量生成向量应该返回相同数量的向量数组', async () => {
    const texts = ['段落1', '段落2', '段落3'];
    const vectors = await service.embedBatch(texts);

    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toHaveLength(1536);
    expect(vectors[1]).toHaveLength(1536);
    expect(vectors[2]).toHaveLength(1536);
  });
});
