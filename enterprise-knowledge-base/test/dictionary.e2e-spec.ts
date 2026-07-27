import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DictionaryModule } from '../src/dictionary/dictionary.module';
import { DictionaryService } from '../src/dictionary/dictionary.service';
import { CategoryEntity } from '../src/dictionary/entities/category.entity';
import { TeamEntity } from '../src/dictionary/entities/team.entity';
import { TagEntity } from '../src/dictionary/entities/tag.entity';

describe('DictionaryService (e2e)', () => {
  let appModuleFixture: TestingModule;
  let service: DictionaryService;

  beforeAll(async () => {
    appModuleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            host: config.get<string>('POSTGRES_HOST', 'localhost'),
            port: config.get<number>('POSTGRES_PORT', 5432),
            username: config.get<string>('POSTGRES_USER', 'postgres'),
            password: config.get<string>('POSTGRES_PASSWORD', ''),
            database: config.get<string>('POSTGRES_DB', 'postgres'),
            ssl: config.get<string>('POSTGRES_HOST')?.includes('supabase')
              ? { rejectUnauthorized: false }
              : false,
            entities: [CategoryEntity, TeamEntity, TagEntity],
            synchronize: false,
          }),
        }),
        DictionaryModule,
      ],
    }).compile();

    service = appModuleFixture.get<DictionaryService>(DictionaryService);
  }, 15000);

  afterAll(async () => {
    if (appModuleFixture) {
      await appModuleFixture.close();
    }
  });

  it('should list all preset categories', async () => {
    const categories = await service.findAllCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('should create a new test category and delete it', async () => {
    const code = `test_cat_${Date.now()}`;
    const created = await service.createCategory({
      name: '测试分类',
      code,
      remark: '用于自动化测试',
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('测试分类');

    const deleted = await service.removeCategory(created.id);
    expect(deleted.success).toBe(true);
  });

  it('should list hot tags and perform Tag CRUD', async () => {
    const hotTags = await service.findHotTags(10);
    expect(Array.isArray(hotTags)).toBe(true);
    expect(hotTags.length).toBeGreaterThan(0);

    const tagName = `测试标签_${Date.now()}`;
    const createdTag = await service.createTag({
      name: tagName,
      color: '#ff0000',
    });

    expect(createdTag.id).toBeDefined();
    expect(createdTag.color).toBe('#ff0000');

    const deleted = await service.removeTag(createdTag.id);
    expect(deleted.success).toBe(true);
  });
});
