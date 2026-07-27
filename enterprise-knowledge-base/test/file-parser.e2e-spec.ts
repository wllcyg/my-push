import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../src/storage/storage.module';
import { FileParserService } from '../src/document/parser/file-parser.service';

describe('FileParserService (e2e)', () => {
  let parserService: FileParserService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        StorageModule,
      ],
      providers: [FileParserService],
    }).compile();

    parserService = moduleFixture.get<FileParserService>(FileParserService);
  });

  it('should throw BadRequestException if file format is unsupported', async () => {
    await expect(
      parserService.parse({
        originalname: 'unsupported.exe',
        buffer: Buffer.from('test'),
      }),
    ).rejects.toThrow('不支持的文件格式');
  });

  it('should parse plain text file', async () => {
    const res = await parserService.parse({
      originalname: 'test.txt',
      buffer: Buffer.from('Hello Knowledge Base'),
    });
    expect(res).toBe('Hello Knowledge Base');
  });
});
