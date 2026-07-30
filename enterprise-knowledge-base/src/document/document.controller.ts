import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { UploadParseDto } from './dto/upload-parse.dto';

/** 文档管理接口 */
@ApiTags('文档管理')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /** 创建文档 */
  @Post()
  @ApiOperation({ summary: '创建文档', description: '创建新的文档元数据与正文内容（雪花ID + 双库联动存储）' })
  create(@Body() dto: CreateDocumentDto) {
    return this.documentService.create(dto);
  }

  /** 前端直传 R2 后的文档解析申请 (高危接口：严格限制单 IP 每分钟最多 10 次解析申请) */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('upload/parse')
  @ApiOperation({ summary: '前端直传 R2 后的文档解析申请', description: '上传本地文档并异步触发表格/Markdown解析' })
  uploadAndParse(@Body() dto: UploadParseDto) {
    return this.documentService.uploadAndCreateDocument(dto);
  }

  /** 分页查询文档列表（仅元数据） */
  @Get()
  @ApiOperation({ summary: '分页查询文档列表', description: '支持按关键词、团队、分类和标签筛选查询文档元数据列表' })
  findAll(@Query() query: QueryDocumentDto) {
    return this.documentService.findAll(query);
  }

  /** 查询文档详情（含正文） */
  @Get(':id')
  @ApiOperation({ summary: '查询文档详情', description: '根据文档 ID 查询 Postgres 元数据和 MongoDB 正文内容' })
  @ApiParam({ name: 'id', description: '文档 ID (雪花ID字符串)' })
  findOne(@Param('id') id: string) {
    return this.documentService.findOne(id);
  }

  /** 更新文档 */
  @Patch(':id')
  @ApiOperation({ summary: '更新文档', description: '更新文档元数据或正文内容（正文更新自动触发版本号递增）' })
  @ApiParam({ name: 'id', description: '文档 ID (雪花ID字符串)' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentService.update(id, dto);
  }

  /** 软删除文档 */
  @Delete(':id')
  @ApiOperation({ summary: '软删除文档', description: '逻辑删除 PostgreSQL 元数据与 MongoDB 正文' })
  @ApiParam({ name: 'id', description: '文档 ID (雪花ID字符串)' })
  remove(@Param('id') id: string) {
    return this.documentService.remove(id);
  }
}
