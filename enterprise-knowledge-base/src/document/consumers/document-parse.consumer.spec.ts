import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DocumentParseConsumer } from './document-parse.consumer';
import { FileParserService } from '../parser/file-parser.service';
import { R2StorageService } from '../../storage/r2-storage.service';
import { DocumentService } from '../document.service';
import { DocumentContent } from '../schemas/document-content.schema';
import { Nack, AmqpConnection } from '@golevelup/nestjs-rabbitmq';

/**
 * DocumentParseConsumer 单元测试
 * 采用 Mock 隔离所有外部依赖（R2、FileParser、DocumentService、Mongo）
 */
describe('DocumentParseConsumer', () => {
  let consumer: DocumentParseConsumer;

  // ——— Mock 对象 ———
  const mockR2Storage = {
    downloadFile: jest.fn(),
  };

  const mockFileParserService = {
    parse: jest.fn(),
  };

  const mockDocumentService = {
    fulfillParsedContent: jest.fn(),
    markDocumentFailed: jest.fn(),
  };

  const mockContentModel = {
    create: jest.fn(),
  };

  const mockAmqpConnection = {
    publish: jest.fn(),
  };

  const basePayload = {
    documentId: '123456789',
    fileR2Key: 'raw-documents/2026-07-28/123456789_test.docx',
    originalFilename: 'test.docx',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: '测试文档',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentParseConsumer,
        { provide: R2StorageService, useValue: mockR2Storage },
        { provide: FileParserService, useValue: mockFileParserService },
        { provide: DocumentService, useValue: mockDocumentService },
        { provide: getModelToken(DocumentContent.name), useValue: mockContentModel },
        { provide: AmqpConnection, useValue: mockAmqpConnection },
      ],
    }).compile();

    consumer = module.get<DocumentParseConsumer>(DocumentParseConsumer);
  });

  // ─────────────────────────────────────────────
  // 正常路径：解析成功
  // ─────────────────────────────────────────────
  describe('handleDocumentParse - 成功场景', () => {
    it('应正确完成：下载文件 → 解析 → 写 Mongo → 回写 Postgres', async () => {
      const fakeBuffer = Buffer.from('fake docx content');
      const fakeParsedContent = '# 测试标题\n\n这是测试内容。';
      const fakeObjectId = '64f1a2b3c4d5e6f7a8b9c0d1';

      mockR2Storage.downloadFile.mockResolvedValue(fakeBuffer);
      mockFileParserService.parse.mockResolvedValue(fakeParsedContent);
      mockContentModel.create.mockResolvedValue({ _id: fakeObjectId });
      mockDocumentService.fulfillParsedContent.mockResolvedValue(undefined);

      const result = await consumer.handleDocumentParse(basePayload);

      // 不应该返回 Nack
      expect(result).toBeUndefined();

      // 验证 R2 下载调用
      expect(mockR2Storage.downloadFile).toHaveBeenCalledWith(basePayload.fileR2Key);

      // 验证解析器调用
      expect(mockFileParserService.parse).toHaveBeenCalledWith({
        originalname: basePayload.originalFilename,
        buffer: fakeBuffer,
        size: fakeBuffer.length,
      });

      // 验证 Mongo 写入
      expect(mockContentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: basePayload.documentId,
          content: fakeParsedContent,
          version: 1,
          deleted: false,
        }),
      );

      // 验证 Postgres 回写
      expect(mockDocumentService.fulfillParsedContent).toHaveBeenCalledWith(
        basePayload.documentId,
        fakeObjectId,
        expect.any(Number),
      );

      // 失败方法不应被调用
      expect(mockDocumentService.markDocumentFailed).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // 失败路径：R2 下载失败
  // ─────────────────────────────────────────────
  describe('handleDocumentParse - R2 下载失败', () => {
    it('应捕获异常，调用 markDocumentFailed 并返回 Nack(false)', async () => {
      mockR2Storage.downloadFile.mockRejectedValue(new Error('R2 网络超时'));
      mockDocumentService.markDocumentFailed.mockResolvedValue(undefined);

      const result = await consumer.handleDocumentParse(basePayload);

      expect(result).toBeInstanceOf(Nack);
      expect(mockDocumentService.markDocumentFailed).toHaveBeenCalledWith(
        basePayload.documentId,
        'R2 网络超时',
      );
      expect(mockDocumentService.fulfillParsedContent).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // 失败路径：文件解析失败
  // ─────────────────────────────────────────────
  describe('handleDocumentParse - 文件解析失败', () => {
    it('应捕获解析异常，调用 markDocumentFailed 并返回 Nack(false)', async () => {
      const fakeBuffer = Buffer.from('corrupt content');
      mockR2Storage.downloadFile.mockResolvedValue(fakeBuffer);
      mockFileParserService.parse.mockRejectedValue(new Error('DOCX 格式损坏，无法提取文本'));
      mockDocumentService.markDocumentFailed.mockResolvedValue(undefined);

      const result = await consumer.handleDocumentParse(basePayload);

      expect(result).toBeInstanceOf(Nack);
      expect(mockDocumentService.markDocumentFailed).toHaveBeenCalledWith(
        basePayload.documentId,
        'DOCX 格式损坏，无法提取文本',
      );
      expect(mockContentModel.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // 边界场景：解析内容为空字符串时 wordCount 为 0
  // ─────────────────────────────────────────────
  describe('handleDocumentParse - 空内容文档', () => {
    it('空内容时 wordCount 应为 0，依然成功落库', async () => {
      const fakeBuffer = Buffer.from('empty doc');
      const fakeObjectId = 'aabbcc112233';

      mockR2Storage.downloadFile.mockResolvedValue(fakeBuffer);
      mockFileParserService.parse.mockResolvedValue('   ');
      mockContentModel.create.mockResolvedValue({ _id: fakeObjectId });
      mockDocumentService.fulfillParsedContent.mockResolvedValue(undefined);

      await consumer.handleDocumentParse(basePayload);

      expect(mockDocumentService.fulfillParsedContent).toHaveBeenCalledWith(
        basePayload.documentId,
        fakeObjectId,
        0, // 空内容 wordCount = 0
      );
    });
  });
});
