import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as crypto from 'crypto';

@Injectable()
export class R2StorageService implements OnModuleInit {
  private readonly logger = new Logger(R2StorageService.name);
  private s3Client!: S3Client;
  private bucketName!: string;
  private publicDomain!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME', '');
    this.publicDomain = this.configService
      .get<string>('R2_PUBLIC_DOMAIN', '')
      .replace(/\/+$/, '');

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });

    this.logger.log(`Initialized Cloudflare R2 Client (Endpoint: ${endpoint})`);
  }

  /**
   * 上传 Buffer 文件到 Cloudflare R2
   * @param buffer 文件内容
   * @param key 存储路径及文件名 (例: "images/example.png")
   * @param contentType MIME 类型 (例: "image/png")
   * @returns 公网访问 URL
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // 返回完整的公网访问 URL
      const publicUrl = `${this.publicDomain}/${key}`;
      this.logger.log(`Uploaded file to R2 successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file to R2 (Key: ${key})`, error);
      throw error;
    }
  }

  /**
   * 专用于 DOCX 图片提取上传的快捷方法
   * 自动按日期和哈希命名存储在 docx-images/ 目录下
   */
  async uploadDocxImage(
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const ext = contentType.split('/')[1] || 'png';
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 10);
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `docx-images/${dateStr}/${Date.now()}_${hash}.${ext}`;

    return this.uploadFile(buffer, key, contentType);
  }

  /**
   * 从 Cloudflare R2 下载指定 Key 的文件，返回 Buffer
   * 供 Consumer 异步解析时使用
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);

      // 将响应 Body（Readable Stream）转换为 Buffer
      const stream = response.Body as Readable;
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to download file from R2 (Key: ${key})`, error);
      throw error;
    }
  }

  /**
   * 从 Cloudflare R2 中删除指定 Key 的文件
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      this.logger.log(`Deleted file from R2: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from R2 (Key: ${key})`, error);
      throw error;
    }
  }
}
