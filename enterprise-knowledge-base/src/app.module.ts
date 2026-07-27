import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentModule } from './document/document.module';
import { StorageModule } from './storage/storage.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { DocumentEntity } from './document/entities/document.entity';
import { CategoryEntity } from './dictionary/entities/category.entity';
import { TeamEntity } from './dictionary/entities/team.entity';
import { TagEntity } from './dictionary/entities/tag.entity';

@Module({
  imports: [
    // 全局配置加载 .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Cloudflare R2 / 对象存储模块
    StorageModule,

    // PostgreSQL + TypeORM 根连接
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
        entities: [DocumentEntity, CategoryEntity, TeamEntity, TagEntity],
        synchronize: false,
      }),
    }),

    // MongoDB + Mongoose 根连接
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/knowledge_hub',
      }),
    }),

    // 业务模块
    DocumentModule,
    DictionaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
