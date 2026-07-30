import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../entities/document.entity';

/** 创建文档 DTO */
export class CreateDocumentDto {
  /** 标题 */
  @ApiProperty({ description: '文档标题', example: 'NestJS 高级应用指南' })
  @IsString()
  title: string;

  /** Markdown 正文 */
  @ApiProperty({ description: 'Markdown 格式正文内容', example: '# NestJS 指南\n\n这是正文内容...' })
  @IsString()
  content: string;

  /** 摘要 */
  @ApiPropertyOptional({ description: '文档摘要信息' })
  @IsOptional()
  @IsString()
  summary?: string;

  /** 分类 ID */
  @ApiPropertyOptional({ description: '所属分类 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** 团队 ID */
  @ApiPropertyOptional({ description: '所属团队 ID' })
  @IsOptional()
  @IsString()
  teamId?: string;

  /** 作者 ID */
  @ApiPropertyOptional({ description: '作者用户 ID' })
  @IsOptional()
  @IsString()
  authorId?: string;

  /** 封面图 URL */
  @ApiPropertyOptional({ description: '封面图 URL 链接' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  /** 标签（逗号分隔） */
  @ApiPropertyOptional({ description: '文档标签（多个标签用逗号分隔）', example: 'NestJS,后端,TypeScript' })
  @IsOptional()
  @IsString()
  tags?: string;

  /** 状态 */
  @ApiPropertyOptional({ description: '文档状态', enum: DocumentStatus, default: DocumentStatus.Published })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  /** 备注 */
  @ApiPropertyOptional({ description: '备注说明' })
  @IsOptional()
  @IsString()
  remark?: string;

  /** 是否公开 */
  @ApiPropertyOptional({ description: '是否公开可访问', default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /** 创建人 ID */
  @ApiPropertyOptional({ description: '创建人用户 ID' })
  @IsOptional()
  @IsString()
  createBy?: string;
}
