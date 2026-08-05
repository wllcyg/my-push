import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DataSource } from 'typeorm';
import { EmbeddingService } from '../../document/services/embedding.service';
import { RerankService } from '../services/rerank.service';

/** 与统一规范保持一致的 1024 维向量 */
const VECTOR_DIM = 1024;

export interface RawChunkResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  distance: number;
  title?: string;
}

export function createKnowledgeRetrieverTool(
  embeddingService: EmbeddingService,
  dataSource: DataSource,
  rerankService?: RerankService,
) {
  return new DynamicStructuredTool({
    name: 'knowledge_retriever',
    description:
      '用于在企业知识库中检索相关的技术文档、业务规范、员工手册或技术简历。当用户提问包含具体业务、公司规范或个人经历时必须调用此工具。',
    schema: z.object({
      query: z
        .string()
        .describe('用于在知识库中进行向量与全文混合匹配的提问关键词或句子'),
    }),
    func: async ({ query }) => {
      console.log(`\n🤖 [Hybrid RAG Tool] 正在发起双路混合检索 (Vector + Full-Text)... query="${query}"`);
      try {
        const cleanQuery = query.trim();

        // 1. 将查询短语向量化 (1024 维)
        const queryVector = await embeddingService.embed(cleanQuery, VECTOR_DIM);
        const vectorStr = `[${queryVector.join(',')}]`;

        // 2. 双路并发召回 (向量语义路 Top 15 + 全文关键词路 Top 15)
        const vectorPromise: Promise<RawChunkResult[]> = dataSource
          .query(
            `
          SELECT 
            c.id, 
            c.document_id, 
            c.chunk_index, 
            c.content, 
            d.title,
            (c.embedding::vector(1024) <=> $1::vector(1024)) AS distance
          FROM kh_document_chunk c
          LEFT JOIN kh_document d ON c.document_id = d.id
          WHERE c.embedding IS NOT NULL 
            AND c.embedding != ''
            AND vector_dims(c.embedding::vector) = 1024
          ORDER BY distance ASC
          LIMIT 15;
        `,
            [vectorStr],
          )
          .catch((err) => {
            console.warn(`⚠️ [Hybrid RAG] 向量路检索异常: ${err.message}`);
            return [];
          });

        const keywordPromise: Promise<RawChunkResult[]> = dataSource
          .query(
            `
          SELECT 
            c.id, 
            c.document_id, 
            c.chunk_index, 
            c.content, 
            d.title,
            0.5 AS distance
          FROM kh_document_chunk c
          LEFT JOIN kh_document d ON c.document_id = d.id
          WHERE c.content ILIKE $1 OR d.title ILIKE $1
          LIMIT 15;
        `,
            [`%${cleanQuery}%`],
          )
          .catch((err) => {
            console.warn(`⚠️ [Hybrid RAG] 关键词全文路检索异常: ${err.message}`);
            return [];
          });

        const [vectorResults, keywordResults] = await Promise.all([
          vectorPromise,
          keywordPromise,
        ]);

        // 3. 去重与初步候选池合并
        const candidateMap = new Map<string, RawChunkResult>();
        vectorResults.forEach((item) => candidateMap.set(item.id, item));
        keywordResults.forEach((item) => {
          if (!candidateMap.has(item.id)) {
            candidateMap.set(item.id, item);
          }
        });

        const candidates = Array.from(candidateMap.values());

        if (candidates.length === 0) {
          return '未在知识库中检索到相关文档切片。';
        }

        console.log(
          `✅ [Hybrid RAG] 双路召回完成，合并去重后获得 ${candidates.length} 个候选切片 (向量路: ${vectorResults.length}, 关键词路: ${keywordResults.length})`,
        );

        // 4. 通义千问 gte-rerank 模型二次精排打分 (取 Top 4)
        let finalTopChunks: Array<{ item: RawChunkResult; score: number }> = [];

        if (rerankService && candidates.length > 0) {
          const candidateTexts = candidates.map(
            (c) => `文档《${c.title || '未知'}》内容：\n${c.content}`,
          );

          const rerankedItems = await rerankService.rerank(
            cleanQuery,
            candidateTexts,
            4,
          );

          finalTopChunks = rerankedItems.map((rk) => ({
            item: candidates[rk.index],
            score: rk.score,
          }));
        } else {
          // 降级兜底方案：直接截取 Top 4
          finalTopChunks = candidates.slice(0, 4).map((c, idx) => ({
            item: c,
            score: 1.0 - idx * 0.1,
          }));
        }

        console.log(
          `🎯 [Hybrid RAG] 截取 Top ${finalTopChunks.length} 核心切片，正在进行 [邻居上下文扩展 ±2]...`,
        );

        // 5. “小块匹配，大块作答” - 邻居上下文扩展 (Context Expansion)
        const expandedResults = await Promise.all(
          finalTopChunks.map(async (topObj, idx) => {
            const { item, score } = topObj;
            const targetDocId = item.document_id;
            const targetIndex = Number(item.chunk_index);

            // 查询同文档中 [targetIndex - 2, targetIndex + 2] 范围内的切片
            const minIndex = Math.max(0, targetIndex - 2);
            const maxIndex = targetIndex + 2;

            const neighborRows: Array<{ chunk_index: number; content: string }> =
              await dataSource
                .query(
                  `
              SELECT chunk_index, content
              FROM kh_document_chunk
              WHERE document_id = $1
                AND chunk_index BETWEEN $2 AND $3
              ORDER BY chunk_index ASC;
            `,
                  [targetDocId, minIndex, maxIndex],
                )
                .catch(() => []);

            let expandedText = item.content;
            let startIdx = targetIndex;
            let endIdx = targetIndex;

            if (neighborRows && neighborRows.length > 0) {
              expandedText = neighborRows.map((r) => r.content).join('\n\n');
              startIdx = neighborRows[0].chunk_index;
              endIdx = neighborRows[neighborRows.length - 1].chunk_index;
            }

            return {
              badgeIndex: idx + 1,
              title: item.title || '未知文档',
              startIdx,
              endIdx,
              score,
              expandedText,
            };
          }),
        );

        // 6. 格式化组装上下文片段并打上 [1], [2] 标注
        const formattedContext = expandedResults
          .map(
            (res) =>
              `【知识片段 [${res.badgeIndex}]】出自文档《${res.title}》(切片范围 #${res.startIdx}-#${res.endIdx}, 匹配度: ${res.score.toFixed(4)}):\n${res.expandedText}`,
          )
          .join('\n\n----------------------------------------\n\n');

        return formattedContext;
      } catch (error) {
        console.error('❌ [Hybrid RAG Tool] 检索失败:', (error as Error).message);
        return '知识库检索异常：' + (error as Error).message;
      }
    },
  });
}
