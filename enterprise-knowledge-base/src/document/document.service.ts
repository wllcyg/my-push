import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { EntityManager } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { nextSnowflakeId } from '../common/snowflake-id';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { UploadParseDto } from './dto/upload-parse.dto';
import {
  DocumentEntity,
  DocumentStatus,
} from './entities/document.entity';
import {
  DocumentContent,
  DocumentContentDocument,
} from './schemas/document-content.schema';
import { R2StorageService } from '../storage/r2-storage.service';
import { FileParserService } from './parser/file-parser.service';
import {
  decodeUploadFilename,
  getExtension,
  titleFromFilename,
} from './parser/utils/markdown.util';
import { DocumentChunkEntity } from './entities/document-chunk.entity';
import { DocumentChunkingService } from './parser/utils/document-chunking.service';
import { EmbeddingService } from './services/embedding.service';

/** MQ 解析任务消息体结构 */
export interface DocumentParseJobPayload {
  documentId: string;
  fileR2Key: string;
  originalFilename: string;
  mimetype: string;
  title: string;
}

/**
 * 文档服务
 * - 元数据：PostgreSQL（kh_document）
 * - 正文：MongoDB（document_content）
 * - 关联：content_id ↔ Mongo _id，documentId ↔ 文档 id
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  /** Topic Exchange 名称 */
  static readonly EXCHANGE = 'knowledge.document.exchange';
  /** 文档解析任务路由键 */
  static readonly PARSE_ROUTING_KEY = 'kb.document.parse';

  constructor(
    /** Postgres 实体管理器 */
    @InjectEntityManager()
    private readonly em: EntityManager,
    /** Mongo 正文模型 */
    @InjectModel(DocumentContent.name)
    private readonly contentModel: Model<DocumentContentDocument>,
    /** 全局缓存管理器 */
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: any,
    /** 文件解析服务 */
    private readonly fileParserService: FileParserService,
    /** Cloudflare R2 对象存储服务 */
    private readonly r2Storage: R2StorageService,
    /** RabbitMQ 连接（用于发布解析任务消息） */
    private readonly amqpConnection: AmqpConnection,
    /** 智能切片服务 */
    private readonly chunkingService: DocumentChunkingService,
    /** Embedding 向量生成服务 */
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * 接收前端直传 R2 后的元数据，在 Postgres 创建 Parsing 占位记录并异步入队 RabbitMQ 解析
   */
  async uploadAndCreateDocument(dto: UploadParseDto) {
    if (!dto.fileUrl || !dto.fileR2Key || !dto.originalFilename) {
      throw new BadRequestException('缺失直传文件元数据信息 (fileUrl, fileR2Key, originalFilename)');
    }

    const originalFilename = decodeUploadFilename(dto.originalFilename);
    const extension = getExtension(originalFilename);

    if (!this.fileParserService.isSupported(extension)) {
      throw new BadRequestException(
        `不支持的文件格式: ${extension || '(无扩展名)'}，支持的格式: ${this.fileParserService.supportedList()}`,
      );
    }

    this.logger.log(
      `接收直传文件入队：name=${originalFilename}, ext=${extension}, fileR2Key=${dto.fileR2Key}`,
    );

    const title = dto.title?.trim() || titleFromFilename(originalFilename);
    const doc = await this.createParsingDocument(title, dto.fileUrl, dto);

    // 向 RabbitMQ 发布解析任务，若 MQ 异常或不可用则自动触发本地后台异步降级解析
    const payload: DocumentParseJobPayload = {
      documentId: doc.id,
      fileR2Key: dto.fileR2Key,
      originalFilename,
      mimetype: dto.mimetype || 'application/octet-stream',
      title,
    };
    try {
      this.logger.log(
        `[RabbitMQ Producer] 📤 正在向 Exchange [${DocumentService.EXCHANGE}] 投递解析任务 | RoutingKey: ${DocumentService.PARSE_ROUTING_KEY}, documentId=${doc.id}`,
      );
      await this.amqpConnection.publish(
        DocumentService.EXCHANGE,
        DocumentService.PARSE_ROUTING_KEY,
        payload,
      );
      this.logger.log(
        `[RabbitMQ Producer] ✅ 解析任务已成功投递到 MQ 队列：documentId=${doc.id}, title=${title}, ext=${extension}`,
      );
    } catch (mqError: any) {
      this.logger.warn(
        `[RabbitMQ Producer] ⚠️ 消息投递失败或 MQ 未就绪 (${mqError.message})，已自动触发本地后台降级解析: documentId=${doc.id}`,
      );
      this.executeDirectParseFallback(payload).catch((err) =>
        this.logger.error(`[降级解析异常] documentId=${doc.id}: ${err.message}`, err.stack),
      );
    }

    return {
      documentId: doc.id,
      title,
      fileUrl: dto.fileUrl,
      fileSize: dto.fileSize || 0,
      fileExtension: extension,
      status: DocumentStatus.Parsing,
      message: '文件已直传，后台正在异步解析中，请稍后刷新查看文档状态',
    };
  }

  /**
   * MQ 不可用时的本地后台降级解析（非阻塞主响应流程，包含正文入库、智能切片与向量化生成落盘）
   */
  private async executeDirectParseFallback(payload: DocumentParseJobPayload) {
    const { documentId, fileR2Key, originalFilename } = payload;
    try {
      const fileBuffer = await this.r2Storage.downloadFile(fileR2Key);
      const parsedContent = await this.fileParserService.parse({
        originalname: originalFilename,
        buffer: fileBuffer,
        size: fileBuffer.length,
      });
      const contentSummary = parsedContent.trim().slice(0, 200);
      const contentDoc = await this.contentModel.create({
        documentId,
        content: parsedContent,
        contentLength: parsedContent.length,
        contentSummary,
        version: 1,
        deleted: false,
      });
      const contentId = String(contentDoc._id);
      const wordCount = this.countWords(parsedContent);
      await this.fulfillParsedContent(documentId, contentId, wordCount);
      this.logger.log(
        `[降级解析] 文档已成功解析并回写：documentId=${documentId}, contentId=${contentId}, words=${wordCount}`,
      );

      // 降级流程中同样触发智能切片与向量化生成落盘
      try {
        const chunks = this.chunkingService.split(parsedContent);
        if (chunks.length > 0) {
          const chunkTexts = chunks.map((c) => c.content);
          const embeddings = await this.embeddingService.embedBatch(chunkTexts);

          await this.em
            .createQueryBuilder()
            .delete()
            .from(DocumentChunkEntity)
            .where('documentId = :documentId', { documentId })
            .execute();

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
            `[降级解析] 向量切片落盘成功：documentId=${documentId}, 切片数=${chunkEntities.length}`,
          );
        }
      } catch (vectorErr: any) {
        this.logger.warn(
          `[降级解析] 向量切片落盘失败 (${vectorErr.message})，不影响正文解析主流程`,
        );
      }
    } catch (err: any) {
      this.logger.error(`[降级解析失败] documentId=${documentId}: ${err.message}`);
      await this.markDocumentFailed(documentId, err.message);
    }
  }

  /**
   * 创建 Parsing 状态的占位文档记录（供 uploadAndCreateDocument 调用）
   * contentId 为 null，待 Consumer 解析完成后回写
   */
  async createParsingDocument(
    title: string,
    fileUrl: string,
    meta: Partial<UploadParseDto> = {},
  ): Promise<DocumentEntity> {
    const id = nextSnowflakeId();
    const doc = this.em.create(DocumentEntity, {
      id,
      title,
      contentId: null,
      summary: meta.summary ?? null,
      categoryId: meta.categoryId ?? null,
      teamId: meta.teamId ?? null,
      authorId: meta.authorId ?? null,
      coverImage: fileUrl,
      tags: meta.tags ?? null,
      status: DocumentStatus.Parsing,
      remark: null,
      isPublic: meta.isPublic ?? false,
      wordCount: 0,
      publishTime: null,
      createBy: meta.createBy ?? null,
      updateBy: meta.createBy ?? null,
      deleted: false,
    });
    return this.em.save(doc);
  }

  /**
   * Consumer 解析成功后回写：填充 contentId，字数，状态置为 Draft
   */
  async fulfillParsedContent(
    documentId: string,
    contentId: string,
    wordCount: number,
  ): Promise<void> {
    await this.em.update(
      DocumentEntity,
      { id: documentId },
      {
        contentId,
        wordCount,
        status: DocumentStatus.Draft,
      },
    );
    this.logger.log(
      `文档解析成功，已回写 contentId：documentId=${documentId}, contentId=${contentId}`,
    );
  }

  /**
   * Consumer 解析失败后标记：状态置为 Failed，记录报错信息
   */
  async markDocumentFailed(
    documentId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.em.update(
      DocumentEntity,
      { id: documentId },
      {
        status: DocumentStatus.Failed,
        // 截断防止超出 varchar 字段长度
        remark: errorMessage.slice(0, 500),
      },
    );
    this.logger.warn(
      `文档解析失败，已标记 Failed：documentId=${documentId}, error=${errorMessage.slice(0, 100)}`,
    );
  }

  /**
   * 创建文档 (@Transactional 声明式事务)
   * 流程：生成雪花 ID → 写 Mongo 正文 → 开启 Postgres 事务写元数据
   * 若发生异常，自动触发事务 ROLLBACK，并原子清理已写入的 Mongo 正文
   */
  @Transactional()
  async create(dto: CreateDocumentDto) {
    const id = nextSnowflakeId();
    const wordCount = this.countWords(dto.content);
    const status = dto.status ?? DocumentStatus.Draft;
    // 未传 summary 时，从正文截取预览作为 contentSummary
    const contentSummary =
      dto.summary ?? this.buildContentSummary(dto.content);

    // 先写 Mongo，_id 由驱动自动生成 ObjectId
    const contentDoc = await this.contentModel.create({
      documentId: id,
      content: dto.content,
      contentLength: dto.content.length,
      contentSummary,
      version: 1,
      deleted: false,
    });
    // ObjectId 转字符串，存入 Postgres content_id
    const contentId = String(contentDoc._id);

    try {
      const doc = this.em.create(DocumentEntity, {
        id,
        title: dto.title,
        contentId,
        summary: dto.summary,
        categoryId: dto.categoryId,
        teamId: dto.teamId,
        authorId: dto.authorId,
        coverImage: dto.coverImage,
        tags: dto.tags,
        status,
        remark: dto.remark,
        isPublic: dto.isPublic ?? false,
        wordCount,
        // 创建即发布时，记录发布时间
        publishTime:
          status === DocumentStatus.Published ? new Date() : null,
        createBy: dto.createBy,
        updateBy: dto.createBy,
        deleted: false,
      });

      const saved = await this.em.save(doc);
      return { ...saved, content: dto.content };
    } catch (error) {
      // Postgres 事务失败：原子回滚删除刚写入的 Mongo 正文
      await this.contentModel.deleteOne({ _id: contentDoc._id });
      this.logger.error(
        `创建文档写 Postgres 事务失败，已原子回滚清理 Mongo 数据: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 分页查询文档列表（只返回 Postgres 元数据，不含正文）
   * 支持按标题模糊、分类 / 团队 / 作者 / 状态筛选
   */
  async findAll(query: QueryDocumentDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // 默认排除已软删记录
    const qb = this.em
      .createQueryBuilder(DocumentEntity, 'doc')
      .where('doc.deleted = :deleted', { deleted: false });

    // 标题模糊匹配（不区分大小写）
    if (query.title) {
      qb.andWhere('doc.title ILIKE :title', { title: `%${query.title}%` });
    }
    if (query.categoryId) {
      qb.andWhere('doc.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.teamId) {
      qb.andWhere('doc.team_id = :teamId', { teamId: query.teamId });
    }
    if (query.authorId) {
      qb.andWhere('doc.author_id = :authorId', { authorId: query.authorId });
    }
    if (query.status !== undefined) {
      qb.andWhere('doc.status = :status', { status: query.status });
    }

    // 按创建时间倒序，再分页
    qb.orderBy('doc.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 查询文档详情 (Cache-Aside 旁路缓存模式)
   * @param withContent 是否附带 Mongo 正文，默认 true
   */
  async findOne(id: string, withContent = true) {
    const cacheKey = `doc:detail:${id}:${withContent}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug(`⚡ [Cache Hit] 命中文档详情缓存: key=${cacheKey}`);
      return cached;
    }

    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    let result: any = doc;
    if (withContent) {
      // 通过 content_id 拉取未删除的正文
      const contentDoc = await this.contentModel
        .findOne({ _id: doc.contentId, deleted: false })
        .lean();
      result = {
        ...doc,
        content: contentDoc?.content ?? '',
      };
    }

    // 写入全局缓存 (有效期 10 分钟 = 600,000 ms)
    await this.cacheManager.set(cacheKey, result, 600000);
    return result;
  }

  /**
   * 更新文档 (@Transactional 声明式事务 + 缓存主动失效)
   * - 有 content：同步更新 Mongo 正文，并递增 version
   * - 仅改 summary：同步更新 Mongo contentSummary
   * - 其余字段只更新 Postgres 元数据
   * - 首次变为「已发布」时写入 publishTime
   */
  @Transactional()
  async update(id: string, dto: UpdateDocumentDto) {
    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // —— 正文变更 ——
    if (dto.content !== undefined) {
      const contentSummary =
        dto.summary ?? this.buildContentSummary(dto.content);
      const result = await this.contentModel.updateOne(
        { _id: doc.contentId, deleted: false },
        {
          $set: {
            content: dto.content,
            contentLength: dto.content.length,
            contentSummary,
          },
          $inc: { version: 1 }, // 版本号 +1
        },
      );
      if (result.matchedCount === 0) {
        throw new BadRequestException(
          `Document content ${doc.contentId} not found`,
        );
      }
      doc.wordCount = this.countWords(dto.content);
    } else if (dto.summary !== undefined) {
      // 只改摘要时，同步 Mongo 侧预览字段
      await this.contentModel.updateOne(
        { _id: doc.contentId, deleted: false },
        { $set: { contentSummary: dto.summary } },
      );
    }

    // —— 元数据字段（有传才覆盖）——
    if (dto.title !== undefined) doc.title = dto.title;
    if (dto.summary !== undefined) doc.summary = dto.summary;
    if (dto.categoryId !== undefined) doc.categoryId = dto.categoryId;
    if (dto.teamId !== undefined) doc.teamId = dto.teamId;
    if (dto.authorId !== undefined) doc.authorId = dto.authorId;
    if (dto.coverImage !== undefined) doc.coverImage = dto.coverImage;
    if (dto.tags !== undefined) doc.tags = dto.tags;
    if (dto.remark !== undefined) doc.remark = dto.remark;
    if (dto.isPublic !== undefined) doc.isPublic = dto.isPublic;
    if (dto.updateBy !== undefined) doc.updateBy = dto.updateBy;

    // 状态从非发布 → 发布时，记录发布时间
    if (dto.status !== undefined) {
      if (
        dto.status === DocumentStatus.Published &&
        doc.status !== DocumentStatus.Published
      ) {
        doc.publishTime = new Date();
      }
      doc.status = dto.status;
    }

    const saved = await this.em.save(doc);

    // 主动清除对应文档的缓存 (Cache Invalidation)
    await this.cacheManager.del(`doc:detail:${id}:true`);
    await this.cacheManager.del(`doc:detail:${id}:false`);

    // 本次已带新正文则直接返回；否则再查一次 Mongo
    if (dto.content !== undefined) {
      return { ...saved, content: dto.content };
    }

    const contentDoc = await this.contentModel
      .findOne({ _id: doc.contentId, deleted: false })
      .lean();
    return { ...saved, content: contentDoc?.content ?? '' };
  }

  /**
   * 软删除文档 (@Transactional 声明式事务 + 缓存主动失效)
   * Postgres、Mongo 两侧都将 deleted 置为 true
   */
  @Transactional()
  async remove(id: string) {
    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    doc.deleted = true;
    await this.em.save(doc);
    await this.contentModel.updateOne(
      { _id: doc.contentId },
      { $set: { deleted: true } },
    );

    // 主动清除关联缓存 (Cache Invalidation)
    await this.cacheManager.del(`doc:detail:${id}:true`);
    await this.cacheManager.del(`doc:detail:${id}:false`);

    return { id, deleted: true };
  }

  /**
   * 从正文截取预览摘要
   * 压缩连续空白后截断到 maxLen，超出则追加省略号
   */
  private buildContentSummary(content: string, maxLen = 200): string {
    const trimmed = content.trim().replace(/\s+/g, ' ');
    return trimmed.length <= maxLen
      ? trimmed
      : `${trimmed.slice(0, maxLen)}...`;
  }

  /**
   * 统计正文字数（中英混合）
   * - 中日韩汉字：每个字符计 1 字
   * - 英文等拉丁文本：按空白分词，每个单词计 1 字
   */
  private countWords(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;

    // 匹配所有 CJK 统一汉字（U+4E00–U+9FFF），每个汉字算 1
    const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;

    // 去掉汉字后，剩余按空白切分为英文单词再计数
    const latin = trimmed
      .replace(/[\u4e00-\u9fff]/g, ' ') // 汉字替换为空格，避免与英文粘连
      .trim()
      .split(/\s+/) // 按连续空白分词
      .filter(Boolean).length; // 去掉空串

    return cjk + latin;
  }
}
