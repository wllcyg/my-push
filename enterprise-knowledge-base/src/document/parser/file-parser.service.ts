import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { R2StorageService } from '../../storage/r2-storage.service';
import { parseDocx } from './parsers/docx.parse';
import { parseXlsx } from './parsers/xlsx.parse';
import { parseCsv } from './parsers/csv.parse';
import { getExtension } from './utils/markdown.util';

/** 支持解析的文件扩展名（当前聚焦于 docx/txt/md/xlsx/xls/csv，后期可拓展 pdf/pptx 等） */
const SUPPORTED_EXTENSIONS = new Set([
  'docx',
  'txt',
  'md',
  'xlsx',
  'xls',
  'csv',
]);

export interface ParseInput {
  originalname: string;
  buffer: Buffer;
  size?: number;
}

/**
 * 文件 → Markdown 解析服务。
 *
 * 按扩展名分发到各 parser；DOCX 解析时将内嵌图片上传到 Cloudflare R2。
 * 解析结果为空或格式不支持时抛 BadRequestException。
 */
@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  constructor(private readonly r2Storage: R2StorageService) {}

  /** 是否为已支持的扩展名（大小写不敏感） */
  isSupported(extension: string): boolean {
    return SUPPORTED_EXTENSIONS.has(extension?.toLowerCase());
  }

  /** 逗号分隔的支持格式列表，用于错误提示 */
  supportedList(): string {
    return [...SUPPORTED_EXTENSIONS].join(', ');
  }

  /**
   * 将上传文件解析为 Markdown 字符串。
   *
   * - docx：调用 parseDocx，内嵌图片自动上传至 Cloudflare R2 并替换为 CDN 链接
   * - txt / md：UTF-8 纯文本解码
   */
  async parse(file: ParseInput): Promise<string> {
    const extension = getExtension(file.originalname);

    if (!this.isSupported(extension)) {
      throw new BadRequestException(
        `不支持的文件格式: ${extension || '(无扩展名)'}，当前支持的格式: ${this.supportedList()}`,
      );
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('文件内容为空，无法解析');
    }

    const start = Date.now();
    let result: string;

    switch (extension) {
      case 'docx':
        result = await parseDocx(file.buffer, {
          // 注入 Cloudflare R2 图片上传回调
          uploadImage: (imageBuffer, contentType) =>
            this.r2Storage.uploadDocxImage(imageBuffer, contentType),
        });
        break;
      case 'xlsx':
      case 'xls':
        result = await parseXlsx(file.buffer);
        break;
      case 'csv':
        result = await parseCsv(file.buffer);
        break;
      case 'txt':
      case 'md':
        result = file.buffer.toString('utf-8');
        break;
      default:
        throw new BadRequestException(`不支持的文件格式: ${extension}`);
    }

    const elapsed = Date.now() - start;
    this.logger.log(
      `文件解析完成: name=${file.originalname}, format=${extension}, chars=${result.length}, elapsed=${elapsed}ms`,
    );

    if (!result?.trim()) {
      throw new BadRequestException(
        '文件解析结果为空，请确认文件包含可提取的文本内容',
      );
    }

    return result;
  }
}
