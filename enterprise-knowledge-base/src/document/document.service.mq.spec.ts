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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getEntityManagerToken(), useValue: mockEntityManager },
        { provide: getModelToken(DocumentContent.name), useValue: mockContentModel },
        { provide: FileParserService, useValue: mockFileParserService },
        { provide: R2StorageService, useValue: mockR2Storage },
        { provide: AmqpConnection, useValue: mockAmqpConnection },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  // ─────────────────────────────────────────────
  // uploadAndCreateDocument
  // ─────────────────────────────────────────────
  describe('uploadAndCreateDocument', () => {
    const fakeFile = {
      buffer: Buffer.from('fake file content'),
      originalname: 'report.docx',
      size: 1024,
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    } as Express.Multer.File;

    it('应上传 R2 → 创建 Parsing 记录 → 投递 MQ → 立即返回', async () => {
      mockFileParserService.isSupported.mockReturnValue(true);
      mockR2Storage.uploadFile.mockResolvedValue('https://cdn.example.com/raw-documents/2026-07-28/xxx_report.docx');

      const fakeSavedDoc = { id: '987654321', status: DocumentStatus.Parsing };
      mockEntityManager.create.mockReturnValue(fakeSavedDoc);
      mockEntityManager.save.mockResolvedValue(fakeSavedDoc);
      mockAmqpConnection.publish.mockResolvedValue(undefined);

      const result = await service.uploadAndCreateDocument(fakeFile, { title: '年度报告' });

      // 应立即返回 Parsing 状态
      expect(result.status).toBe(DocumentStatus.Parsing);
      expect(result.documentId).toBe('987654321');
      expect(result.message).toContain('异步解析');

      // R2 上传被调用
      expect(mockR2Storage.uploadFile).toHaveBeenCalledTimes(1);

      // MQ 发布被调用，且携带正确的 Exchange 和 RoutingKey
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        DocumentService.EXCHANGE,
        DocumentService.PARSE_ROUTING_KEY,
        expect.objectContaining({
          documentId: '987654321',
          originalFilename: 'report.docx',
        }),
      );
    });

    it('不支持的文件格式应抛出 BadRequestException', async () => {
      mockFileParserService.isSupported.mockReturnValue(false);

      await expect(
        service.uploadAndCreateDocument({
          ...fakeFile,
          originalname: 'unknown.xyz',
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);

      // 不应触发上传和 MQ
      expect(mockR2Storage.uploadFile).not.toHaveBeenCalled();
      expect(mockAmqpConnection.publish).not.toHaveBeenCalled();
    });

    it('文件 Buffer 为空时应抛出 BadRequestException', async () => {
      await expect(
        service.uploadAndCreateDocument({
          ...fakeFile,
          buffer: Buffer.alloc(0),
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('R2 上传失败时应抛出 BadRequestException，不应投递 MQ', async () => {
      mockFileParserService.isSupported.mockReturnValue(true);
      mockR2Storage.uploadFile.mockRejectedValue(new Error('S3 连接超时'));

      await expect(service.uploadAndCreateDocument(fakeFile)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAmqpConnection.publish).not.toHaveBeenCalled();
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

    it('超长错误信息应被截断至 500 个字符', async () => {
      mockEntityManager.update.mockResolvedValue({ affected: 1 });
      const longError = 'A'.repeat(600);

      await service.markDocumentFailed('doc-003', longError);

      const updateCall = mockEntityManager.update.mock.calls[0][2];
      expect(updateCall.remark.length).toBeLessThanOrEqual(500);
    });
  });
});
