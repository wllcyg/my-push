import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { DocumentService } from './document.service';
import { DocumentContent } from './schemas/document-content.schema';
import { DocumentStatus } from './entities/document.entity';
import { FileParserService } from './parser/file-parser.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { BadRequestException } from '@nestjs/common';
import { DocumentChunkingService } from './parser/utils/document-chunking.service';
import { EmbeddingService } from './services/embedding.service';

/**
 * DocumentService 单元测试
 * 重点测试新增的异步 MQ 相关方法
 */
describe('DocumentService - MQ 异步相关方法', () => {
  let service: DocumentService;

  const mockEntityManager = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockContentModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockFileParserService = {
    isSupported: jest.fn(),
    supportedList: jest.fn().mockReturnValue('docx, txt, md, xlsx, xls, csv'),
    parse: jest.fn(),
  };

  const mockR2Storage = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
  };

  const mockAmqpConnection = {
    publish: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getEntityManagerToken(), useValue: mockEntityManager },
        { provide: getModelToken(DocumentContent.name), useValue: mockContentModel },
        { provide: 'CACHE_MANAGER', useValue: mockCacheManager },
        { provide: FileParserService, useValue: mockFileParserService },
        { provide: R2StorageService, useValue: mockR2Storage },
        { provide: AmqpConnection, useValue: mockAmqpConnection },
        { provide: DocumentChunkingService, useValue: { split: jest.fn() } },
        { provide: EmbeddingService, useValue: { embedBatch: jest.fn() } },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  // ─────────────────────────────────────────────
  // uploadAndCreateDocument
  // ─────────────────────────────────────────────
  describe('uploadAndCreateDocument', () => {
    const fakeDto = {
      fileUrl: 'https://cdn.example.com/raw-documents/2026-07-28/xxx_report.docx',
      fileR2Key: 'raw-documents/2026-07-28/xxx_report.docx',
      originalFilename: 'report.docx',
      fileSize: 1024,
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      title: '年度报告',
    };

    it('应基于直传元数据创建 Parsing 记录 → 投递 MQ → 立即返回', async () => {
      mockFileParserService.isSupported.mockReturnValue(true);

      const fakeSavedDoc = { id: '987654321', status: DocumentStatus.Parsing };
      mockEntityManager.create.mockReturnValue(fakeSavedDoc);
      mockEntityManager.save.mockResolvedValue(fakeSavedDoc);
      mockAmqpConnection.publish.mockResolvedValue(undefined);

      const result = await service.uploadAndCreateDocument(fakeDto);

      // 应立即返回 Parsing 状态
      expect(result.status).toBe(DocumentStatus.Parsing);
      expect(result.documentId).toBe('987654321');
      expect(result.message).toContain('异步解析');

      // MQ 发布被调用，且携带正确的 Exchange 和 RoutingKey
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        DocumentService.EXCHANGE,
        DocumentService.PARSE_ROUTING_KEY,
        expect.objectContaining({
          documentId: '987654321',
          originalFilename: 'report.docx',
          fileR2Key: 'raw-documents/2026-07-28/xxx_report.docx',
        }),
      );
    });

    it('不支持的文件格式应抛出 BadRequestException', async () => {
      mockFileParserService.isSupported.mockReturnValue(false);

      await expect(
        service.uploadAndCreateDocument({
          ...fakeDto,
          originalFilename: 'unknown.xyz',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockAmqpConnection.publish).not.toHaveBeenCalled();
    });

    it('缺失直传核心元数据时应抛出 BadRequestException', async () => {
      await expect(
        service.uploadAndCreateDocument({
          ...fakeDto,
          fileUrl: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // fulfillParsedContent
  // ─────────────────────────────────────────────
  describe('fulfillParsedContent', () => {
    it('应调用 em.update 写入 contentId、wordCount 并将状态置为 Draft', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });

      await service.fulfillParsedContent('doc-001', 'mongo-objectid-abc', 512);

      expect(mockEntityManager.update).toHaveBeenCalledWith(
        expect.anything(), // DocumentEntity
        { id: 'doc-001' },
        expect.objectContaining({
          contentId: 'mongo-objectid-abc',
          wordCount: 512,
          status: DocumentStatus.Draft,
        }),
      );
    });

    it('wordCount 为 0 时也应成功写入（空文档边界）', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });

      await service.fulfillParsedContent('doc-empty', 'mongo-objectid-empty', 0);

      expect(mockEntityManager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'doc-empty' },
        expect.objectContaining({ wordCount: 0, status: DocumentStatus.Draft }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // markDocumentFailed
  // ─────────────────────────────────────────────
  describe('markDocumentFailed', () => {
    it('应调用 em.update 将状态置为 Failed 并记录 remark', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });

      await service.markDocumentFailed('doc-002', '文件解析超时，mammoth 返回空内容');

      expect(mockEntityManager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'doc-002' },
        expect.objectContaining({
          status: DocumentStatus.Failed,
          remark: '文件解析超时，mammoth 返回空内容',
        }),
      );
    });

    it('超长错误信息应被截断至 500 个字符（保留前 500 字符）', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });
      const longError = 'A'.repeat(300) + 'B'.repeat(300); // 600 字符

      await service.markDocumentFailed('doc-003', longError);

      const updateCall = mockEntityManager.update.mock.calls[0][2];
      // 精确验证：长度不超过 500
      expect(updateCall.remark.length).toBeLessThanOrEqual(500);
      // 精确验证：保留的是前 500 字符（前 300 个 A + 后 200 个 B）
      expect(updateCall.remark.startsWith('A'.repeat(300))).toBe(true);
    });

    it('错误信息恰好为 500 个字符时不应截断', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });
      const exactError = 'C'.repeat(500);

      await service.markDocumentFailed('doc-004', exactError);

      const updateCall = mockEntityManager.update.mock.calls[0][2];
      expect(updateCall.remark).toBe(exactError);
      expect(updateCall.remark.length).toBe(500);
    });

    it('错误信息在 500 字符以内时不应截断', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });
      const shortError = '文件解析失败，mammoth 返回空内容';

      await service.markDocumentFailed('doc-005', shortError);

      const updateCall = mockEntityManager.update.mock.calls[0][2];
      expect(updateCall.remark).toBe(shortError);
    });
  });
});
