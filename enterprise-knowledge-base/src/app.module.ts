import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
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

    // 全局接口限流防护 (默认: 单 IP 60秒内最多 120 次请求)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),

    // 全局缓存层配置 (TTL 10 分钟，最多 1000 条热点数据)
    CacheModule.register({
      isGlobal: true,
      ttl: 600000,
      max: 1000,
    }),

    // RabbitMQ 全局连接（基于 CloudAMQP，Topic Exchange）
    {
      ...RabbitMQModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          exchanges: [
            {
              name: 'knowledge.document.exchange',
              type: 'topic',
            },
          ],
          uri:
            config.get<string>('RABBITMQ_URL') ||
            config.get<string>('RABBITMQ_URI') ||
            'amqp://guest:guest@localhost:5672',
          // 启动时不阻塞等待 MQ 连接，避免 MQ 暂时不可用导致服务无法启动
          connectionInitOptions: { wait: false },
          enableControllerDiscovery: true,
        }),
      }),
      global: true,
    },

    // Cloudflare R2 / 对象存储模块
    StorageModule,

    // PostgreSQL + TypeORM 根连接 (配合 typeorm-transactional)
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
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed to dataSourceFactory');
        }
        return addTransactionalDataSource(new DataSource(options));
      },
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
  providers: [
    AppService,
    // 全局挂载限流拦截 Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
