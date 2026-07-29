import * as dotenv from 'dotenv';
dotenv.config();

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { createLoggerOptions } from './common/logger/logger.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const serverUrl = `http://localhost:${port}`;

  // 美化控制台启动输出与核心路由打印
  logger.log('==================================================');
  logger.log('🚀 企业级知识库后端服务 (Enterprise Knowledge Base) 启动成功！');
  logger.log(`📌 运行端口: ${port}`);
  logger.log(`🌐 服务地址: ${serverUrl}`);
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
