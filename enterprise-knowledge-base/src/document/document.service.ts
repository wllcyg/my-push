import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EntityManager } from 'typeorm';
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
    /** 文件解析服务 */
    private readonly fileParserService: FileParserService,
    /** Cloudflare R2 对象存储服务 */
    private readonly r2Storage: R2StorageService,
    /** RabbitMQ 连接（用于发布解析任务消息） */
    private readonly amqpConnection: AmqpConnection,
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

    // 向 RabbitMQ 发布解析任务，Consumer 异步处理
    const payload: DocumentParseJobPayload = {
      documentId: doc.id,
      fileR2Key: dto.fileR2Key,
      originalFilename,
      mimetype: dto.mimetype || 'application/octet-stream',
      title,
    };
    await this.amqpConnection.publish(
      DocumentService.EXCHANGE,
      DocumentService.PARSE_ROUTING_KEY,
      payload,
    );

    this.logger.log(
      `文件已入队解析：documentId=${doc.id}, title=${title}, ext=${extension}, fileR2Key=${dto.fileR2Key}`,
    );

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
   * 创建文档
   * 流程：生成雪花 ID → 写 Mongo 正文（拿 ObjectId）→ 写 Postgres 元数据
   * 若 Postgres 写入失败，回滚删除已写入的 Mongo 正文，避免脏数据
   */
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
        publishTime: status === DocumentStatus.Published ? new Date() : null,
        createBy: dto.createBy,
        updateBy: dto.createBy,
        deleted: false,
      });

      const saved = await this.em.save(doc);
      return { ...saved, content: dto.content };
    } catch (error) {
      // Postgres 失败：物理删除刚写入的 Mongo 正文
      await this.contentModel.deleteOne({ _id: contentDoc._id });
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
   * 查询文档详情
   * @param withContent 是否附带 Mongo 正文，默认 true
   */
  async findOne(id: string, withContent = true) {
    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (!withContent) {
      return doc;
    }

    // 通过 content_id 拉取未删除的正文
    const contentDoc = await this.contentModel
      .findOne({ _id: doc.contentId, deleted: false })
      .lean();
    return {
      ...doc,
      content: contentDoc?.content ?? '',
    };
  }

  /**
   * 更新文档
   * - 有 content：同步更新 Mongo 正文，并递增 version
   * - 仅改 summary：同步更新 Mongo contentSummary
   * - 其余字段只更新 Postgres 元数据
   * - 首次变为「已发布」时写入 publishTime
   */
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
   * 软删除文档
   * Postgres、Mongo 两侧都将 deleted 置为 true（不物理删正文）
   */
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
