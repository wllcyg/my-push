import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimension: number;

  constructor(private readonly configService: ConfigService) {
    const rawUrl =
      this.configService.get<string>('EMBEDDING_API_URL') ||
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
    this.apiUrl = rawUrl.endsWith('/embeddings')
      ? rawUrl
      : `${rawUrl.replace(/\/+$/, '')}/embeddings`;

    this.apiKey =
      this.configService.get<string>('EMBEDDING_API_KEY') ||
      this.configService.get<string>('ALIYUN_API_KEY') ||
      '';

    this.model =
      this.configService.get<string>('EMBEDDING_MODEL') ||
      this.configService.get<string>('OPENAI_EMBEDDING_NAME') ||
      'text-embedding-v4';

    this.dimension = Number(
      this.configService.get<number>('EMBEDDING_DIMENSION') || 1024,
    );
  }

  /**
   * 将单条文本生成向量嵌入 (Float 数组)
   * @param text 输入文本
   * @param overrideDimension 可选：强制指定维度，用于与数据库已有向量精确对齐
   */
  async embed(text: string, overrideDimension?: number): Promise<number[]> {
    const results = await this.embedBatch([text], overrideDimension);
    return results[0];
  }

  /**
   * 批量将文本列表生成向量嵌入
   * @param texts 输入文本列表
   * @param overrideDimension 可选：强制指定维度（优先于配置值）
   */
  async embedBatch(texts: string[], overrideDimension?: number): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];

    const dim = overrideDimension ?? this.dimension;

    // 若配置了有效的 API Key，发起真实的 HTTP 向量计算请求
    if (this.apiKey && this.apiKey.trim()) {
      try {
        return await this.fetchRemoteEmbeddings(texts, dim);
      } catch (error: any) {
        this.logger.warn(
          `调用远程 Embedding API 失败 (${error.message})，回退到本地 Mock 向量模式`,
        );
      }
    }

    // 无 API Key 或远程调用失败时，使用确定性算法生成归一化 Mock 向量
    return texts.map((t) => this.generateMockVector(t, dim));
  }

  /**
   * 调用 OpenAI / 阿里百炼兼容的 /v1/embeddings 向量接口（按 MAX 10 条自动分批）
   * @param texts 输入文本列表
   * @param dimension 向量维度（显式传入，确保与数据库一致）
   */
  private async fetchRemoteEmbeddings(texts: string[], dimension: number): Promise<number[][]> {
    const BATCH_SIZE = 10;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model: this.model,
          dimensions: dimension,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Embedding API 响应异常 HTTP ${response.status}: ${errText}`,
        );
      }

      const json = await response.json();
      if (!json.data || !Array.isArray(json.data)) {
        throw new Error('Embedding API 返回格式非法');
      }

      const batchEmbeddings = json.data.map((item: any) => item.embedding);
      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  }

  /**
   * 基于字符串 Hash 生成指定维度的归一化 Float 向量（降级/测试用）
   */
  generateMockVector(text: string, dimension = 1024): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    const vector: number[] = [];
    let norm = 0;

    for (let i = 0; i < dimension; i++) {
      // 假伪随机生成 -1 ~ 1 之间的浮点数
      const val = Math.sin(hash + i);
      vector.push(val);
      norm += val * val;
    }

    // 向量归一化 (L2 norm)
    norm = Math.sqrt(norm) || 1;
    return vector.map((v) => Number((v / norm).toFixed(6)));
  }
}
