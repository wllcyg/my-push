import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SemanticCacheService {
  private readonly logger = new Logger(SemanticCacheService.name);
  private readonly moduleName = 'semantic_cache';
  private readonly defaultTtl = 7 * 86400; // 默认 7 天生存期（自动挥发防爆发）

  constructor(private readonly redisService: RedisService) {}

  /** 标准化文本，去除首尾空格及问号语气词 */
  private normalizeQuery(query: string): string {
    return String(query || '')
      .trim()
      .toLowerCase()
      .replace(/[？\?！!。，,呢啊呀吗吧]+$/g, '');
  }

  /** 查询 Redis 问答快捷/语义缓存 */
  async getMatchedCache(query: string): Promise<string | null> {
    const cleanKey = this.normalizeQuery(query);
    if (!cleanKey) return null;

    const cachedAnswer = await this.redisService.getJson<string>(this.moduleName, cleanKey);
    if (cachedAnswer) {
      this.logger.log(`⚡ [SemanticCache] 命中语义缓存快捷路径! query="${cleanKey}" (耗时 < 5ms, 0 Token)`);
      return cachedAnswer;
    }
    return null;
  }

  /** 存储问答对到 Redis 语义缓存（7 天 TTL 防爆） */
  async setMatchedCache(query: string, answer: string, ttlSeconds = this.defaultTtl): Promise<void> {
    const cleanKey = this.normalizeQuery(query);
    if (!cleanKey || !answer) return;

    await this.redisService.setJson(this.moduleName, cleanKey, answer, ttlSeconds);
    this.logger.log(`💾 [SemanticCache] 已写入语义缓存: query="${cleanKey}" (TTL ${ttlSeconds}s)`);
  }
}
