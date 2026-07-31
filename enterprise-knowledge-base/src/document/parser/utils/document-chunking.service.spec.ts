import { DocumentChunkingService } from './document-chunking.service';

describe('DocumentChunkingService', () => {
  let service: DocumentChunkingService;

  beforeEach(() => {
    service = new DocumentChunkingService();
  });

  it('空文本应该返回空数组', () => {
    expect(service.split('')).toEqual([]);
    expect(service.split('   ')).toEqual([]);
  });

  it('简短文本应该直接作为一个切片，包含标题层级元数据', () => {
    const md = `# 知识库使用指南
这是一个简单的介绍段落。`;
    const chunks = service.split(md, { maxChunkSize: 600 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toContain('这是一个简单的介绍段落');
    expect(chunks[0].metadata.headers).toEqual(['知识库使用指南']);
  });

  it('多层级标题文本应该正确识别标题路径', () => {
    const md = `# 架构指南
## 存储模块
存储模块支持 Cloudflare R2。
## 解析模块
解析模块支持 DOCX 与 CSV。`;

    const chunks = service.split(md, { maxChunkSize: 600 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].metadata.headerPath).toBe('架构指南 > 存储模块');
    expect(chunks[1].metadata.headerPath).toBe('架构指南 > 解析模块');
  });

  it('超过 maxChunkSize 的长段落应该使用滑动窗口正确切分并产生重叠', () => {
    const longText = '企业知识库技术架构说明文本。'.repeat(100);
    const md = `# 详细说明\n${longText}`;

    const chunks = service.split(md, { maxChunkSize: 200, overlapSize: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    // 检查 index 递增
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
    // 检查 metadata 标记
    expect(chunks[1].metadata.isSubChunk).toBe(true);
  });
});
