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

  // 极简控制台启动日志输出
  logger.log(`🚀 服务启动成功 | 运行地址: ${serverUrl}`);
  if (!isProduction) {
    logger.log(`📚 Swagger 文档地址: ${serverUrl}/${swaggerPath}`);
  }
}

bootstrap();
