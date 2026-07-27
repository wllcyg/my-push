import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../src/storage/storage.module';
import { R2StorageService } from '../src/storage/r2-storage.service';

describe('R2StorageService (e2e)', () => {
  let service: R2StorageService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        StorageModule,
      ],
    }).compile();

    service = moduleFixture.get<R2StorageService>(R2StorageService);
    // 触发初始化
    service.onModuleInit();
  });

  it('should upload a sample image buffer to Cloudflare R2 and delete it', async () => {
    // 1px 透明 PNG 图片的 Buffer
    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    // 测试上传 DOCX 图片
    const publicUrl = await service.uploadDocxImage(samplePngBuffer, 'image/png');
    console.log('✅ R2 Test Upload Success, Public URL:', publicUrl);

    expect(publicUrl).toContain('https://image-dev.cheatppf.xyz/docx-images/');

    // 提取 key 并清理测试文件
    const key = publicUrl.replace('https://image-dev.cheatppf.xyz/', '');
    await service.deleteFile(key);
    console.log('✅ R2 Test Delete Success, Key:', key);
  }, 15000);
});
