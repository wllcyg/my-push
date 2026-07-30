import * as dotenv from 'dotenv';
dotenv.config();

import { initializeTransactionalContext } from 'typeorm-transactional';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { createLoggerOptions } from './common/logger/logger.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// 初始化 typeorm-transactional 异步上下文 (AsyncLocalStorage)
initializeTransactionalContext();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createLoggerOptions()),
  });

  // 全局挂载 HTTP 日志拦截器与全量异常过滤器
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // 开启全局 DTO 参数校验与转换（字符串自动转数字、自动剥离多余字段）
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 开启跨域 CORS 支持
  app.enableCors();

  // 配置 Swagger OpenAPI 接口文档（带生产环境隔离保护）
  const isProduction = process.env.NODE_ENV === 'production';
  const swaggerPath = 'api-docs';

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('企业级知识库后端服务 API')
      .setDescription(
        '基于 NestJS + PostgreSQL (pgvector) + MongoDB 的企业知识库后端服务接口文档',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const serverUrl = `http://localhost:${port}`;

  // 美化控制台启动输出与核心路由打印
  logger.log('==================================================');
  logger.log('🚀 企业级知识库后端服务 (Enterprise Knowledge Base) 启动成功！');
  logger.log(`📌 运行端口: ${port}`);
  logger.log(`🌐 服务地址: ${serverUrl}`);
  if (!isProduction) {
    logger.log(`📚 Swagger 文档地址: ${serverUrl}/${swaggerPath}`);
  } else {
    logger.log(`🔒 生产环境安全防护: Swagger API 文档已被自动禁用`);
  }
  logger.log('==================================================');
  logger.log('🛠️ 已挂载文档模块 (DocumentModule) 核心 API 路由列表：');
  logger.log(
    `  [POST]   ${serverUrl}/documents       -> 创建文档 (雪花ID + 双库联动)`,
  );
  logger.log(
    `  [GET]    ${serverUrl}/documents       -> 分页与多条件筛选查询文档列表`,
  );
  logger.log(
    `  [GET]    ${serverUrl}/documents/:id   -> 查询文档详情 (含 Mongo Markdown 正文)`,
  );
  logger.log(
    `  [PATCH]  ${serverUrl}/documents/:id   -> 更新文档 (正文版本递增/元数据覆盖)`,
  );
  logger.log(
    `  [DELETE] ${serverUrl}/documents/:id   -> 软删除文档 (Postgres & Mongo 双侧逻辑删除)`,
  );
  logger.log('==================================================');
}

bootstrap();
