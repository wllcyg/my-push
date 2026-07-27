import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateDocumentDto } from './create-document.dto';

/** 更新文档 DTO（继承自 CreateDocumentDto，自动将字段设为可选，并移除 createBy） */
export class UpdateDocumentDto extends PartialType(
  OmitType(CreateDocumentDto, ['createBy'] as const),
) {
  /** 更新人 ID */
  @IsOptional()
  @IsString()
  updateBy?: string;
}
