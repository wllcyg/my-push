import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly projectPrefix = 'kb';
  private hitsCount = 0;
  private missesCount = 0;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('UPSTASH_REDIS_REST_URL');
    const token = this.configService.get<string>('UPSTASH_REDIS_REST_TOKEN');

    if (url && token && !url.includes('your_upstash')) {
      try {
        this.client = new Redis({ url, token });
        this.logger.log(`⚙️ [RedisService] 成功连接云端 Upstash Redis (${url})`);
      } catch (error) {
        this.logger.error(`❌ [RedisService] 连接初始化失败: ${(error as Error).message}`);
      }
    } else {
      this.logger.warn('⚠️ [RedisService] 未配置有效的 Upstash Redis 凭证，降级运作');
    }
  }

  /** 生成标准 Key: kb:{module}:{key} */
  private makeKey(module: string, key: string): string {
    const modClean = String(module).replace(/^:+|:+$/g, '');
    const keyClean = String(key).replace(/^:+|:+$/g, '');
    return `${this.projectPrefix}:${modClean}:${keyClean}`;
  }

  /** TTL 抖动防雪崩（±10% 随机偏移） */
  private applyTtlJitter(baseTtl: number, jitterPercentage = 0.1): number {
    if (baseTtl <= 0) return baseTtl;
    const jitter = Math.floor(baseTtl * jitterPercentage);
    if (jitter < 1) return baseTtl;
    const randomOffset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    return baseTtl + randomOffset;
  }

  /** 存储 JSON 数据 */
  async setJson(module: string, key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      const fullKey = this.makeKey(module, key);
      const jsonStr = JSON.stringify(value);
      const finalTtl = ttlSeconds ? this.applyTtlJitter(ttlSeconds) : undefined;

      if (finalTtl) {
        await this.client.set(fullKey, jsonStr, { ex: finalTtl });
      } else {
        await this.client.set(fullKey, jsonStr);
      }
      return true;
    } catch (error) {
      this.logger.error(`❌ [RedisService] setJson 失败 (${module}:${key}): ${(error as Error).message}`);
      return false;
    }
  }

  /** 读取 JSON 数据 */
  async getJson<T = any>(module: string, key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const fullKey = this.makeKey(module, key);
      const val = await this.client.get<string | object>(fullKey);
      if (val !== null && val !== undefined) {
        this.hitsCount++;
        if (typeof val === 'string') {
          return JSON.parse(val) as T;
        }
        return val as T;
      }
      this.missesCount++;
      return null;
    } catch (error) {
      this.logger.error(`❌ [RedisService] getJson 失败 (${module}:${key}): ${(error as Error).message}`);
      return null;
    }
  }

  /** 删除 Key */
  async delete(module: string, key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const fullKey = this.makeKey(module, key);
      await this.client.del(fullKey);
      return true;
    } catch (error) {
      this.logger.error(`❌ [RedisService] delete 失败 (${module}:${key}): ${(error as Error).message}`);
      return false;
    }
  }

  /** 获取原生 Upstash Redis 客户端句柄 */
  getClient(): Redis | null {
    return this.client;
  }
}
