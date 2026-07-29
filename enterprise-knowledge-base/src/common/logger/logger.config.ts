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

  // 修复 @axiomhq/winston 1.8.0 官方包直接传输数组导致被序列化为 '[object Object]' 被 Axiom 拒收的 Bug
  WinstonTransport.prototype.flush = async function () {
    if (!this.batch || this.batch.length === 0) return;
    const batchToSend = this.batch;
    this.batch = [];
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = undefined;
    }
    const payload = batchToSend.map((item: any) => JSON.stringify(item)).join('\n');
    try {
      await this.client.ingestRaw(this.dataset, payload, 'application/x-ndjson');
    } catch (err) {
      console.error('[AxiomTransport] Flush error:', err);
    }
  };

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
