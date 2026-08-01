import { createKnowledgeRetrieverTool } from './knowledge-retriever.tool';

describe('createKnowledgeRetrieverTool', () => {
  const mockEmbeddingService = {
    embed: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  // 构建标准检索结果
  const buildChunk = (overrides: Partial<{
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    title: string;
    distance: number;
  }> = {}) => ({
    id: 'chunk_1',
    document_id: 'doc_1',
    chunk_index: 0,
    content: '这是测试内容。',
    title: '测试文档.docx',
    distance: 0.1,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // 工具实例创建
  // ─────────────────────────────────────────────
  describe('工具实例创建', () => {
    it('应正确创建 DynamicStructuredTool 实例，name 为 knowledge_retriever', () => {
      const tool = createKnowledgeRetrieverTool(
        mockEmbeddingService as any,
        mockDataSource as any,
      );

      expect(tool.name).toBe('knowledge_retriever');
    });

    it('description 应提及知识库与向量语义匹配，供 LLM 决策使用', () => {
      const tool = createKnowledgeRetrieverTool(
        mockEmbeddingService as any,
        mockDataSource as any,
      );

      expect(tool.description).toContain('知识库');
      expect(tool.description.length).toBeGreaterThan(20);
    });

    it('schema 应要求 query 字段（string 类型）', () => {
      const tool = createKnowledgeRetrieverTool(
        mockEmbeddingService as any,
        mockDataSource as any,
      );

      // 验证 Zod schema 能正确解析合法输入
      const parsed = tool.schema.safeParse({ query: '测试查询' });
      expect(parsed.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 正常检索路径
  // ─────────────────────────────────────────────
  describe('正常检索路径', () => {
    it('应先对 query 进行 embed 向量化，再使用 ::vector 强转执行相似度查询', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDataSource.query.mockResolvedValue([buildChunk()]);

      await tool.invoke({ query: '测试规范' });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('测试规范', 1024);

      const sqlQuery: string = mockDataSource.query.mock.calls[0][0];
      expect(sqlQuery).toContain('c.embedding::vector(1024) <=> $1::vector(1024)');
      expect(sqlQuery).toContain('vector_dims(c.embedding::vector) = 1024');
    });

    it('向量参数应以 [x,y,z] 字符串格式传入 SQL 参数', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDataSource.query.mockResolvedValue([buildChunk()]);

      await tool.invoke({ query: '测试' });

      const sqlParams = mockDataSource.query.mock.calls[0][1];
      expect(sqlParams).toEqual(['[0.1,0.2,0.3]']);
    });

    it('检索结果应按 1-indexed 格式化为【知识片段 N】结构', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1]);
      mockDataSource.query.mockResolvedValue([
        buildChunk({ chunk_index: 0, content: '第一段内容', title: '文档A.docx' }),
      ]);

      const result = await tool.invoke({ query: '查询' });

      expect(result).toContain('【知识片段 1】');
      expect(result).toContain('《文档A.docx》');
      expect(result).toContain('(切片序号 #0)');
      expect(result).toContain('第一段内容');
    });

    it('多个检索结果应按距离排序，顺序格式化（1、2、3...）', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1]);
      mockDataSource.query.mockResolvedValue([
        buildChunk({ id: 'c1', content: '最相关内容', distance: 0.05 }),
        buildChunk({ id: 'c2', content: '次相关内容', distance: 0.15 }),
        buildChunk({ id: 'c3', content: '第三相关内容', distance: 0.30 }),
      ]);

      const result = await tool.invoke({ query: '查询' });

      const idx1 = result.indexOf('【知识片段 1】');
      const idx2 = result.indexOf('【知识片段 2】');
      const idx3 = result.indexOf('【知识片段 3】');

      // 验证顺序正确
      expect(idx1).toBeLessThan(idx2);
      expect(idx2).toBeLessThan(idx3);

      // 验证内容与顺序对应
      expect(result.indexOf('最相关内容')).toBeLessThan(result.indexOf('次相关内容'));
    });

    it('文档 title 为 null 时应使用"未知文档"替代', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1]);
      mockDataSource.query.mockResolvedValue([
        buildChunk({ title: null as any, content: '无标题文档内容' }),
      ]);

      const result = await tool.invoke({ query: '查询' });

      expect(result).toContain('《未知文档》');
      expect(result).toContain('无标题文档内容');
    });
  });

  // ─────────────────────────────────────────────
  // 空结果路径
  // ─────────────────────────────────────────────
  describe('空结果路径', () => {
    it('数据库返回空数组时应返回标准未命中提示', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await tool.invoke({ query: '不存在的内容' });

      expect(result).toBe('未在知识库中检索到相关文档切片。');
    });

    it('数据库返回 null 时应返回标准未命中提示', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1]);
      mockDataSource.query.mockResolvedValue(null);

      const result = await tool.invoke({ query: '查询' });

      expect(result).toBe('未在知识库中检索到相关文档切片。');
    });
  });

  // ─────────────────────────────────────────────
  // 异常路径
  // ─────────────────────────────────────────────
  describe('异常路径', () => {
    it('EmbeddingService.embed 抛出异常时，工具应捕获并返回错误提示字符串（不向外抛出）', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockRejectedValue(new Error('Embedding API 超时'));

      const result = await tool.invoke({ query: '查询' });

      expect(result).toContain('知识库检索异常');
      expect(result).toContain('Embedding API 超时');
      // 不应向外抛出
      expect(typeof result).toBe('string');
    });

    it('PostgreSQL 查询抛出异常时，工具应捕获并返回错误提示字符串（不向外抛出）', async () => {
      const tool = createKnowledgeRetrieverTool(mockEmbeddingService as any, mockDataSource as any);

      mockEmbeddingService.embed.mockResolvedValue([0.1]);
      mockDataSource.query.mockRejectedValue(new Error('operator does not exist: text <=> vector'));

      const result = await tool.invoke({ query: '查询' });

      expect(result).toContain('知识库检索异常');
      expect(typeof result).toBe('string');
    });
  });
});
