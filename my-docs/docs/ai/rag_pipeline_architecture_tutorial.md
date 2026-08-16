# 🧠 RAG 核心知识管线（Pipeline）架构与实战教学文档

> 本文档深入解析 AI 知识库系统中最核心的 **RAG 异步知识加工管线（Pipeline）**，涵盖 **数据聚合、智能分块（Chunking）、向量化嵌入（Embedding）、Elasticsearch 向量库落盘与总编排调度** 的完整工业级落地实现。

---

## 目录
- [一、 RAG 知识管线全景架构图](#一-rag-知识管线全景架构图)
- [二、 核心数据模型契约 (pipeline.types.ts)](#二-核心数据模型契约-pipelinetypests)
  - [1. 文档聚合快照 (PipelineDocument)](#1-文档聚合快照-pipelinedocument)
  - [2. 工业级切片模型 (DocumentChunk)](#2-工业级切片模型-documentchunk)
- [三、 智能分块服务 (ChunkingService)](#三-智能分块服务-chunkingservice)
  - [1. 为什么要分块？](#1-为什么要分块)
  - [2. Token 与字符换算机制](#2-token-与字符换算机制)
  - [3. Markdown 语法感知递归切分](#3-markdown-语法感知递归切分)
  - [4. 🌟 核心杀手锏：章节标题继承与前缀补全](#4--核心杀手锏章节标题继承与前缀补全)
  - [5. SHA256 稳定幂等 ID 生成](#5-sha256-稳定幂等-id-生成)
- [四、 向量化计算服务 (EmbeddingService)](#四-向量化计算服务-embeddingservice)
  - [1. 多模型提供商适配（DashScope / OpenAI）](#1-多模型提供商适配dashscope--openai)
  - [2. 批量请求上限保护（Batch Size Clamping）](#2-批量请求上限保护batch-size-clamping)
- [五、 向量索引存储服务 (VectorIndexService)](#五-向量索引存储服务-vectorindexservice)
  - [1. 自动初始化 Elasticsearch Mapping (dense_vector)](#1-自动初始化-elasticsearch-mapping-dense_vector)
  - [2. 幂等清理旧块 (deleteByDocId)](#2-幂等清理旧块-deletebydocid)
  - [3. 高性能 Bulk 批量管道写入](#3-高性能-bulk-批量管道写入)
- [六、 知识管线总编排器 (PipelineOrchestrator)](#六-知识管线总编排器-pipelineorchestrator)
  - [1. 为什么需要总编排器？](#1-为什么需要总编排器)
  - [2. 双库数据聚合查询 (PostgreSQL + MongoDB)](#2-双库数据聚合查询-postgresql--mongodb)
  - [3. 单篇 5 步流水线逐行解析](#3-单篇-5-步流水线逐行解析)
  - [4. ISO-8601 日期安全转换](#4-iso-8601-日期安全转换)
- [七、 高频架构设计问题与实战 Q&A](#七-高频架构设计问题与实战-qa)

---

## 一、 RAG 知识管线全景架构图

```mermaid
flowchart TD
    subgraph Trigger ["1. 触发与输入"]
        A["MQ 消费者<br/>(DocumentPipelineConsumer)"] -->|传参: documentIds| B["PipelineOrchestrator.handleRagReindex()"]
    end

    subgraph Step1 ["2. 双库数据聚合"]
        B --> C["loadDocumentsByIds()"]
        C -->|查元数据与权限| D[("PostgreSQL: kh_document")]
        C -->|查 Markdown 全量正文| E[("MongoDB: document_content")]
        D & E -->|拼装| F["PipelineDocument 快照"]
    end

    subgraph Step2 ["3. 幂等清理"]
        F --> G["VectorIndexService.deleteByDocId()"]
        G -->|清空该文档在 ES 中的历史旧块| H[("Elasticsearch: kh_chunk")]
    end

    subgraph Step3 ["4. 智能切片 (Chunking)"]
        G --> I["ChunkingService.chunk()"]
        I -->|1. 递归 Markdown 语法切分<br/>2. 标题上下文前缀补全<br/>3. 计算 SHA256 稳定 ID| J["DocumentChunk[] (未含向量)"]
    end

    subgraph Step4 ["5. 高维向量化 (Embedding)"]
        J --> K["EmbeddingService.embedBatch()"]
        K -->|批量调用 DashScope text-embedding-v3| L["1024 维 float[] 稠密向量"]
        L -->|回填到 chunk.embedding| M["DocumentChunk[] (已含向量)"]
    end

    subgraph Step5 ["6. 批量落库索引"]
        M --> N["VectorIndexService.indexChunks()"]
        N -->|es.bulk() 批量管道写入| H
    end

    style Trigger fill:#e3f2fd,stroke:#1565c0
    style Step1 fill:#f3e5f5,stroke:#6a1b9a
    style Step2 fill:#ffebee,stroke:#c62828
    style Step3 fill:#e8f5e9,stroke:#2e7d32
    style Step4 fill:#fff3e0,stroke:#e65100
    style Step5 fill:#e0f2f1,stroke:#00695c
```

---

## 二、 核心数据模型契约 (`pipeline.types.ts`)

在 [`src/pipeline/pipeline.types.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/pipeline/pipeline.types.ts) 中定义了管线流转的标准数据结构：

### 1. 文档聚合快照 (`PipelineDocument`)
```typescript
export interface PipelineDocument {
  id: string;              // 文档雪花 ID
  title: string;           // 文档标题
  content: string;         // 🌟 来自 MongoDB 的全量 Markdown 正文
  summary?: string | null;
  categoryId?: string | null;
  authorId?: string | null;
  teamId?: string | null;
  status: number;
  tags?: string | null;
  isPublic?: boolean;
  publishTime?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}
```
* **设计目的**：将 PostgreSQL 中的结构化元数据（标题、分类、团队、权限、状态）与 MongoDB 中的非结构化长正文（Markdown 内容）聚合为一份纯净的快照，使下游各个专业服务无需关心数据来自哪个数据库。

---

### 2. 工业级切片模型 (`DocumentChunk`)
```typescript
export interface DocumentChunk {
  /** 稳定 ID：sha256(documentId:index) 前 64 位，重建时可直接覆盖 */
  chunkId: string;
  documentId: string;
  documentTitle: string;
  /** 实际送去嵌入 / 抽取的文本（通常含章节标题前缀） */
  content: string;
  /** 所属 Markdown 标题；无标题章节为 null */
  heading?: string | null;
  /** 从 0 开始的块序号 */
  chunkIndex: number;
  /** 该文档总块数（切完后回填） */
  totalChunks: number;
  /** 多租户与权限过滤字段 */
  categoryId?: string | null;
  authorId?: string | null;
  teamId?: string | null;
  docStatus?: number | null;
  publishTime?: string | null;
  /** 向量槽位：分块阶段为空，Embedding 计算后填充 1024 维向量 */
  embedding?: number[];
}
```

---

## 三、 智能分块服务 (`ChunkingService`)

文件位置：[`src/pipeline/chunking.service.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/pipeline/chunking.service.ts)

### 1. 为什么要分块？
* **Embedding 模型输入长度有限**（超出最大 token 上限会被直接截断丢失信息）。
* **检索精准度要求**：整篇文档直接召回噪声太大，大模型需要精确命中相关的具体小节/段落。

### 2. Token 与字符换算机制
* 配置：`RAG_CHUNK_SIZE`（默认 512 tokens）、`RAG_CHUNK_OVERLAP`（默认 64 tokens）。
* 换算系数：`CHARS_PER_TOKEN = 2.0`（中英混合场景下，512 tokens ≈ 1024 字符，64 tokens ≈ 128 字符）。

### 3. Markdown 语法感知递归切分
采用 `@langchain/textsplitters` 的 `RecursiveCharacterTextSplitter`，并按以下优先级递归寻找切分点：
```
1. '\n# '   (一级标题)
2. '\n## '  (二级标题)
3. '\n### ' (三级标题)
4. '\n\n'   (段落空行)
5. '\n'     (换行)
6. '。' / '！' / '？' (句末标点)
7. ' ' / '' (空格与单字)
```
**效果**：绝不在句子或代码块中间硬切，优先保证章节与段落的语义完整。

### 4. 🌟 核心杀手锏：章节标题继承与前缀补全
当一个大章节被切成多个 Chunk 时，第 2、3 个切片往往不包含章节标题行，容易成为“失去上下文的孤儿切片”。
代码中实现了自动追踪与前缀补全：
```typescript
const headingInChunk = this.extractHeading(trimmed);
if (headingInChunk) {
  currentHeading = headingInChunk; // 捕获当前所属章节标题
}

let chunkContent = trimmed;
// 🌟 如果当前切片内部没有标题行，自动在前缀拼接上一级标题！
if (currentHeading && !ChunkingService.HEADING_LINE.test(trimmed)) {
  chunkContent = `${currentHeading}\n\n${trimmed}`;
}
```
**收益**：使每个切片无论位于多深的段落，都自带所属标题语境，**向量检索匹配准确率成倍提升**。

### 5. SHA256 稳定幂等 ID 生成
```typescript
chunkId: createHash('sha256')
  .update(`${documentId}:${chunks.length}`)
  .digest('hex')
  .slice(0, 64)
```
无论重复索引多少次，相同序号切片的 `chunkId` 永远保持一致，写入 ES 时直接主键覆盖（Upsert），杜绝重复脏数据。

---

## 四、 向量化计算服务 (`EmbeddingService`)

文件位置：[`src/pipeline/embedding.service.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/pipeline/embedding.service.ts)

### 1. 多模型提供商适配
* 基于 `@langchain/openai` 的 `OpenAIEmbeddings` 封装。
* 默认连接 **通义千问/阿里云百炼 DashScope** 兼容端点：
  * `EMBEDDING_BASE_URL`: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  * `EMBEDDING_MODEL`: `text-embedding-v3`
  * `EMBEDDING_DIMENSION`: `1024`（输出 1024 维高维向量）
* **`stripNewLines: false`**：保留 Markdown 切片内部换行，防止语义过度压扁。

### 2. 批量请求上限保护
* DashScope `text-embedding-v3` 限制单次批量请求最多传 **10 条** 文本。
* 代码中增加钳制保护：
  ```typescript
  const batchSize = Math.min(configuredBatch > 0 ? configuredBatch : 10, 10);
  ```
  底层由 LangChain 自动将大数组分批并发请求，兼顾吞吐量与稳定性。

---

## 五、 向量索引存储服务 (`VectorIndexService`)

文件位置：[`src/pipeline/vector-index.service.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/pipeline/vector-index.service.ts)

### 1. 自动初始化 Elasticsearch Mapping (`kh_chunk`)
启动时调用 `createIndexIfNotExists()`，自动创建索引 Mapping：
```typescript
mappings: {
  properties: {
    chunk_id: { type: 'keyword' },
    document_id: { type: 'keyword' },
    document_title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    content: { type: 'text' },            // 支持全文检索 (BM25)
    heading: { type: 'keyword' },
    chunk_index: { type: 'integer' },
    total_chunks: { type: 'integer' },
    category_id: { type: 'keyword' },     // 元数据过滤字段
    author_id: { type: 'keyword' },
    team_id: { type: 'keyword' },
    doc_status: { type: 'integer' },
    publish_time: { type: 'date' },
    indexed_at: { type: 'date' },
    embedding: {                          // 🌟 高维向量字段
      type: 'dense_vector',
      dims: 1024,
      index: true,                        // 开启 HNSW 向量近似搜索
      similarity: 'cosine',               // 余弦相似度
    },
  },
}
```

### 2. 幂等清理旧块 (`deleteByDocId`)
在重新索引入库前，先执行：
```typescript
await this.es.deleteByQuery({
  index: CHUNK_INDEX,
  query: { term: { document_id: documentId } },
  refresh: true,
});
```
彻底清空此文档历史上的所有旧切片，防止文档编辑精简后残留幽灵脏数据。

### 3. 高性能 Bulk 批量管道写入
```typescript
const operations = chunks.flatMap((chunk) => [
  { index: { _index: CHUNK_INDEX, _id: chunk.chunkId } },
  this.buildDocMap(chunk),
]);
await this.es.bulk({ refresh: true, operations });
```
一次网络 IO 批量提交全部切片，提升写入性能。

---

## 六、 知识管线总编排器 (`PipelineOrchestrator`)

文件位置：[`src/pipeline/pipeline.orchestrator.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/pipeline/pipeline.orchestrator.ts)

### 1. 为什么需要总编排器？
* **职责解耦**：MQ 消费者只管收发消息，不负责复杂业务逻辑；
* **多入口复用**：无论是由 MQ 异步驱动、HTTP 手动重新索引接口触发、还是定时任务扫描触发，均统一调用 `PipelineOrchestrator.handleRagReindex()`。

### 2. 单篇 5 步流水线调度核心实现
```typescript
private async reindexOne(doc: PipelineDocument) {
  if (!doc.content?.trim()) return;

  // Step 1: 清旧块
  await this.vectorIndexService.deleteByDocId(doc.id);

  // Step 2: 智能切片
  const chunks = await this.chunkingService.chunk({
    content: doc.content,
    documentId: doc.id,
    documentTitle: doc.title,
    categoryId: doc.categoryId,
    authorId: doc.authorId,
    teamId: doc.teamId,
    docStatus: doc.status,
    publishTime: this.toIsoDate(doc.publishTime),
  });

  if (!chunks.length) return;

  // Step 3: 批量向量化计算
  const embeddings = await this.embeddingService.embedBatch(
    chunks.map((c) => c.content),
  );
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = embeddings[i];
  }

  // Step 4: 批量落盘入 ES
  await this.vectorIndexService.indexChunks(chunks);
}
```

### 3. ISO-8601 日期安全转换 (`toIsoDate`)
防御性将任何 `Date` 对象或时间戳转换为标准 ISO-8601 字符串（如 `2026-08-15T15:10:00.000Z`），防止因格式不合规被 Elasticsearch 拒绝。

---

## 七、 高频架构设计问题与实战 Q&A

### Q1: 为什么分块时不直接按固定 500 字一刀切，而要用 Markdown 递归切分？
* **解答**：固定字数切分容易把一句话、一个代码块或表格硬生生切成两半，破坏语义连贯性。Markdown 递归切分优先在标题和空行（段落）处切断，能保证送入大模型的每个 Chunk 都是语义自洽的段落。

### Q2: 什么是 Metadata Filtering（元数据过滤）？为什么这些字段要打入每个 Chunk？
* **解答**：在企业级 RAG 中，用户检索往往带有权限和维度限制（如“只搜当前团队 `teamId=10`”、“只搜 `categoryId=2` 的技术文档”）。将这些元数据字段冗余打入每个 `DocumentChunk` 存入 ES，搜索引擎即可在计算向量相似度的同时进行毫秒级的前置元数据过滤。

### Q3: 为什么把向量存在 Elasticsearch 的 dense_vector 里，而不是单独搞一个纯向量数据库（如 Chroma/Pinecone）？
* **解答**：
  1. **混合检索优势**：Elasticsearch 既拥有成熟强大的 BM25 全文倒排索引（IK 中文分词），又原生支持 `dense_vector` 余弦向量检索。通过一套引擎即可原生实现 **BM25 + kNN + RRF 融合排序**，避免在两个独立数据库间维护分布式事务。
  2. **运维成本极低**：减少一套组件的运维负担。

---

## 🎯 总结
通过 `pipeline.types.ts`、`chunking.service.ts`、`embedding.service.ts`、`vector-index.service.ts` 与 `pipeline.orchestrator.ts` 的紧密协作，整个 RAG 系统具备了**工业级的语义切片、高维向量化与多维索引存储能力**，为后续的 **RAG 混合检索与大模型问答问答（Chat & Generation）** 奠定了最坚实的数据底座！
