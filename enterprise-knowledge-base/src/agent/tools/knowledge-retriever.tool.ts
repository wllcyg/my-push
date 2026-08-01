import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DataSource } from 'typeorm';
import { EmbeddingService } from '../../document/services/embedding.service';

/** 与统一规范保持一致的 1024 维向量 */
const VECTOR_DIM = 1024;

export function createKnowledgeRetrieverTool(
  embeddingService: EmbeddingService,
  dataSource: DataSource,
) {
  return new DynamicStructuredTool({
    name: 'knowledge_retriever',
    description:
      '用于在企业知识库中检索相关的技术文档、业务规范、员工手册或技术简历。当用户提问包含具体业务、公司规范或个人经历时必须调用此工具。',
    schema: z.object({
      query: z
        .string()
        .describe('用于在知识库中进行向量语义匹配的提问关键词或句子'),
    }),
    func: async ({ query }) => {
      console.log(`\n🤖 [LangChain Tool] 正在触发知识库向量检索... query="${query}"`);
      try {
        // 1. 将查询短语向量化，强制指定 1024 维
        const queryVector = await embeddingService.embed(query, VECTOR_DIM);
        const vectorStr = `[${queryVector.join(',')}]`;

        console.log(`📐 [LangChain Tool] 查询向量维度: ${queryVector.length}`);

        // 2. 在 Supabase pgvector 关联查询 Top 4 最匹配切片与文档标题
        // 显式限制 1024 维度
        const rawResults: Array<{
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          distance: number;
          title?: string;
        }> = await dataSource.query(
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
          LIMIT 4;
        `,
          [vectorStr],
        );

        if (!rawResults || rawResults.length === 0) {
          return '未在知识库中检索到相关文档切片。';
        }

        console.log(`✅ [LangChain Tool] 检索成功，命中了 ${rawResults.length} 个知识切片：`);
        rawResults.forEach((item, idx) => {
          console.log(`   [${idx + 1}] 📄 《${item.title || '未命名文档'}》 (相似度距离: ${item.distance.toFixed(4)})`);
        });

        // 3. 格式化组装为供 Agent 参阅的上下文片段
        const formattedContext = rawResults
          .map(
            (item, idx) =>
              `【知识片段 ${idx + 1}】出自文档《${item.title || '未知文档'}》(切片序号 #${item.chunk_index}):\n${item.content}`,
          )
          .join('\n\n');

        return formattedContext;
      } catch (error) {
        console.error('❌ [LangChain Tool] 检索向量库失败:', error.message);
        return '知识库检索异常：' + error.message;
      }
    },
  });
}
