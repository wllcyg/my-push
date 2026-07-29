import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '../entities/document.entity';

/** 前端直传 R2 后的提交解析接口 DTO */
export class UploadParseDto {
  /** 云端对象存储公网访问 URL */
  @IsString()
  fileUrl!: string;

  /** 云端对象存储 Key */
  @IsString()
  fileR2Key!: string;

  /** 原始文件名 */
  @IsString()
  originalFilename!: string;

  /** MIME 类型 */
  @IsOptional()
  @IsString()
  mimetype?: string;

  /** 文件字节大小 */
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  /** 自定义标题（可选，不传时自动从文件名推导去除后缀的标题） */
  @IsOptional()
  @IsString()
  title?: string;

  /** 摘要 */
  @IsOptional()
  @IsString()
  summary?: string;

  /** 分类 ID */
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** 团队 ID */
  @IsOptional()
  @IsString()
  teamId?: string;

  /** 作者 ID */
  @IsOptional()
  @IsString()
  authorId?: string;

  /** 封面图 URL */
  @IsOptional()
  @IsString()
  coverImage?: string;

  /** 标签（逗号分隔） */
  @IsOptional()
  @IsString()
  tags?: string;

  /** 状态 */
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  /** 备注 */
  @IsOptional()
  @IsString()
  remark?: string;

  /** 创建人 ID */
  @IsOptional()
  @IsString()
  createBy?: string;

  /** 
   * 是否公开
   * 表单上传 (multipart/form-data) 传输的均为字符串，
   * 利用 Transform 将 "true" / "1" 转换为真正的 boolean 类型
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  isPublic?: boolean;
}
