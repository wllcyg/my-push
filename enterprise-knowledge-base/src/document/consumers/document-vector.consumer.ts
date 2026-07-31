import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { InjectModel } from '@nestjs/mongoose';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { EntityManager } from 'typeorm';
import {
  DocumentContent,
  DocumentContentDocument,
} from '../schemas/document-content.schema';
import { DocumentChunkingService } from '../parser/utils/document-chunking.service';
import { EmbeddingService } from '../services/embedding.service';
import { DocumentChunkEntity } from '../entities/document-chunk.entity';
import { DocumentService } from '../document.service';
import { nextSnowflakeId } from '../../common/snowflake-id';

/** 向量化任务 MQ Payload 消息体 */
export interface DocumentVectorJobPayload {
  documentId: string;
  contentId: string;
}

@Injectable()
export class DocumentVectorConsumer {
  private readonly logger = new Logger(DocumentVectorConsumer.name);

  /** 向量化任务 Routing Key */
  static readonly VECTOR_ROUTING_KEY = 'kb.document.vectorize';

  constructor(
    @InjectEntityManager()
    private readonly em: EntityManager,
    @InjectModel(DocumentContent.name)
    private readonly contentModel: Model<DocumentContentDocument>,
    private readonly chunkingService: DocumentChunkingService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @RabbitSubscribe({
    exchange: DocumentService.EXCHANGE,
    routingKey: DocumentVectorConsumer.VECTOR_ROUTING_KEY,
    queue: 'kb.document.vectorize.queue',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'knowledge.document.dlx',
      },
    },
  })
  async handleDocumentVectorize(
    payload: DocumentVectorJobPayload,
  ): Promise<void | Nack> {
    const { documentId, contentId } = payload;
    this.logger.log(
      `[MQ Vector Consumer] 收到向量化任务：documentId=${documentId}, contentId=${contentId}`,
    );

    try {
      // 1. 从 MongoDB 读取解析好的 Markdown 正文
      const contentDoc = await this.contentModel
        .findOne({ _id: contentId, deleted: false })
        .lean();

      if (!contentDoc || !contentDoc.content) {
        this.logger.warn(
          `[MQ Vector Consumer] 未找到对应正文内容，跳过向量化: contentId=${contentId}`,
        );
        return;
      }

      // 2. 文本切片
      const chunks = this.chunkingService.split(contentDoc.content);
      if (chunks.length === 0) {
        this.logger.warn(
          `[MQ Vector Consumer] 切片结果为空，跳过向量化: documentId=${documentId}`,
        );
        return;
      }

      // 3. 批量生成向量
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingService.embedBatch(chunkTexts);

      // 4. 清理旧切片 (若已存在)，实现幂等落盘
      await this.em.delete(DocumentChunkEntity, { documentId });

      // 5. 构建并写入向量切片实体列表
      const chunkEntities = chunks.map((chunk, idx) => {
        return this.em.create(DocumentChunkEntity, {
          id: nextSnowflakeId(),
          documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          wordCount: chunk.wordCount,
          embedding: embeddings[idx] ?? null,
          metadata: chunk.metadata,
        });
      });

      await this.em.save(DocumentChunkEntity, chunkEntities);

      this.logger.log(
        `[MQ Vector Consumer] 文档向量化入库完成：documentId=${documentId}, 切片数=${chunkEntities.length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[MQ Vector Consumer] 文档向量化失败：documentId=${documentId}, error=${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return new Nack(false);
    }
  }
}
