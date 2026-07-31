import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection, RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DocumentContent,
  DocumentContentDocument,
} from '../schemas/document-content.schema';
import { FileParserService } from '../parser/file-parser.service';
import { R2StorageService } from '../../storage/r2-storage.service';
import { DocumentService } from '../document.service';
import type { DocumentParseJobPayload } from '../document.service';
import { DocumentVectorConsumer } from './document-vector.consumer';

/**
 * 文档解析异步消费者
 *
 * 监听 RabbitMQ Topic Exchange 上的 kb.document.parse 路由键
 * 职责：从 R2 下载原始文件 → 解析为 Markdown → 写 Mongo → 回写 Postgres → 触发向量化
 */
@Injectable()
export class DocumentParseConsumer {
  private readonly logger = new Logger(DocumentParseConsumer.name);

  constructor(
    @InjectModel(DocumentContent.name)
    private readonly contentModel: Model<DocumentContentDocument>,
    private readonly fileParserService: FileParserService,
    private readonly r2Storage: R2StorageService,
    private readonly documentService: DocumentService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @RabbitSubscribe({
    exchange: DocumentService.EXCHANGE,
    routingKey: DocumentService.PARSE_ROUTING_KEY,
    queue: 'kb.document.parse.queue',
    queueOptions: {
      // 队列持久化，服务重启后消息不丢失
      durable: true,
      // 消费失败超过 maxRetries 次后转入死信队列（如已配置）
      arguments: {
        'x-dead-letter-exchange': 'knowledge.document.dlx',
      },
    },
  })
  async handleDocumentParse(
    payload: DocumentParseJobPayload,
  ): Promise<void | Nack> {
    const { documentId, fileR2Key, originalFilename, mimetype } = payload;

    this.logger.log(
      `[MQ Consumer] 收到解析任务：documentId=${documentId}, file=${originalFilename}`,
    );

    try {
      // Step 1：从 Cloudflare R2 下载原始文件 Buffer
      const fileBuffer = await this.r2Storage.downloadFile(fileR2Key);
      this.logger.log(
        `[MQ Consumer] 文件下载成功：fileR2Key=${fileR2Key}, size=${fileBuffer.length}`,
      );

      // Step 2：调用 FileParserService 解析生成 Markdown（DOCX 图片自动转存 R2）
      const parsedContent = await this.fileParserService.parse({
        originalname: originalFilename,
        buffer: fileBuffer,
        size: fileBuffer.length,
      });
      this.logger.log(
        `[MQ Consumer] 文件解析完成：documentId=${documentId}, chars=${parsedContent.length}`,
      );

      // Step 3：在 Mongo 新建正文记录，获得 ObjectId（增加网络抖动重试机制）
      const contentSummary = parsedContent.trim().slice(0, 200);
      let contentDoc;
      let retries = 3;
      while (retries > 0) {
        try {
          contentDoc = await this.contentModel.create({
            documentId,
            content: parsedContent,
            contentLength: parsedContent.length,
            contentSummary,
            version: 1,
            deleted: false,
          });
          break;
        } catch (err: any) {
          retries--;
          if (retries === 0) throw err;
          this.logger.warn(`[MQ Consumer] MongoDB 写入网络波动，正在进行自动重试 (剩余 ${retries} 次): ${err.message}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      const contentId = String(contentDoc!._id);

      // Step 4：统计字数并回写 Postgres（contentId, wordCount, status → Draft）
      const wordCount = this.countWords(parsedContent);
      await this.documentService.fulfillParsedContent(
        documentId,
        contentId,
        wordCount,
      );

      // Step 5：向 RabbitMQ 投递 kb.document.vectorize 消息，触发异步文本切片与向量化
      await this.amqpConnection.publish(
        DocumentService.EXCHANGE,
        DocumentVectorConsumer.VECTOR_ROUTING_KEY,
        { documentId, contentId },
      );

      this.logger.log(
        `[MQ Consumer] 文档解析入库完成，已投递向量化任务：documentId=${documentId}, contentId=${contentId}, words=${wordCount}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[MQ Consumer] 文档解析失败：documentId=${documentId}, error=${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      // 标记 Postgres 状态为 Failed，供前端/运维排查
      await this.documentService.markDocumentFailed(documentId, message);

      // 返回 Nack(false) 表示不重新入队（已标记 Failed，避免死循环）
      // 如需自动重试，改为 return new Nack(true)
      return new Nack(false);
    }
  }

  /**
   * 统计正文字数（中英混合）
   * - CJK 汉字：每字符计 1 字
   * - 拉丁文本：按空白分词计数
   */
  private countWords(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const latin = trimmed
      .replace(/[\u4e00-\u9fff]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return cjk + latin;
  }
}
