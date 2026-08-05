import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AGENT_MODEL_CONFIG } from '../agent.constants';

export interface RerankResultItem {
  index: number;
  score: number;
  document?: string;
}

@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 调用通义千问百炼 (DashScope) Rerank 模型进行语义重排
   * @param query 用户提问
   * @param documents 待重排候选文本数组
   * @param topN 目标截取前 N 个
   */
  async rerank(
    query: string,
    documents: string[],
    topN: number = 4,
  ): Promise<RerankResultItem[]> {
    if (!documents || documents.length === 0) {
      return [];
    }

    const apiKey =
      this.configService.get<string>('ALIYUN_API_KEY') ||
      this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey || apiKey === 'sk-mock') {
      this.logger.warn(
        `⚠️ [RerankService] 未配置 ALIYUN_API_KEY，跳过 Rerank 模型重排，降级返回原候选顺序`,
      );
      return documents.slice(0, topN).map((doc, index) => ({
        index,
        score: 1.0 - index * 0.05,
        document: doc,
      }));
    }

    const modelName =
      this.configService.get<string>('RERANK_MODEL_NAME') ||
      AGENT_MODEL_CONFIG.RERANK_MODEL_NAME;

    try {
      this.logger.log(
        `🎯 [DashScope Rerank] 发起 ${modelName} 重排请求 | Query: "${query}" | 候选数量: ${documents.length}`,
      );

      const response = await fetch(
        'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            input: {
              query,
              documents,
            },
            parameters: {
              return_documents: true,
              top_n: topN,
            },
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const results: Array<{ index: number; relevance_score: number }> =
        data?.output?.results || [];

      if (!results || results.length === 0) {
        this.logger.warn(
          `⚠️ [DashScope Rerank] API 未返回有效重排结果，降级取候选前 ${topN} 条`,
        );
        return documents.slice(0, topN).map((doc, index) => ({
          index,
          score: 1.0,
          document: doc,
        }));
      }

      this.logger.log(
        `✅ [DashScope Rerank] gte-rerank 重排完成，最高匹配分: ${results[0]?.relevance_score?.toFixed(4)}`,
      );

      return results.map((item) => ({
        index: item.index,
        score: item.relevance_score,
        document: documents[item.index],
      }));
    } catch (error) {
      this.logger.error(
        `❌ [DashScope Rerank] 重排请求异常，触发兜底逻辑: ${(error as Error).message}`,
      );
      // 容错兜底机制：原样截取 topN
      return documents.slice(0, topN).map((doc, index) => ({
        index,
        score: 0.8,
        document: doc,
      }));
    }
  }
}
