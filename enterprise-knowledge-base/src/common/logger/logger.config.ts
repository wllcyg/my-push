import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';
import { WinstonTransport } from '@axiomhq/winston';

export const createLoggerOptions = (): WinstonModuleOptions => {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, traceId, ...meta }) => {
          const ctxStr = context ? `[${context}] ` : '';
          const traceStr = traceId ? `(trace:${traceId}) ` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${ctxStr}${traceStr}${message}${metaStr}`;
        }),
      ),
    }),
  ];

  // 如果配置了 Axiom 密钥和 Dataset，自动启用云端日志离线批量推送
  const axiomDataset = process.env.AXIOM_DATASET;
  const axiomToken = process.env.AXIOM_TOKEN;

  if (axiomDataset && axiomToken) {
    transports.push(
      new WinstonTransport({
        dataset: axiomDataset,
        token: axiomToken,
      }),
    );
  }

  return {
    transports,
  };
};
