import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { R2StorageService } from './r2-storage.service';

export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty({ message: '文件名 (filename) 不能为空' })
  filename!: string;

  @IsString()
  @IsOptional()
  contentType?: string;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly r2Storage: R2StorageService) {}

  /**
   * 获取 R2 直传预签名 URL (Presigned PUT URL)
   * 严格防护：单 IP 每分钟最多申请 10 次预签名上传链接
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('presigned-url')
  async getPresignedUrl(@Body() dto: PresignedUrlDto) {
    if (!dto?.filename) {
      throw new BadRequestException('文件名 (filename) 不能为空');
    }

    return this.r2Storage.getPresignedUploadUrl(
      dto.filename,
      dto.contentType || 'application/octet-stream',
    );
  }
}
