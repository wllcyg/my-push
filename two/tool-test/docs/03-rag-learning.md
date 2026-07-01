# RAG (检索增强生成) 核心原理与实战总结

![首图](https://api.cheatppf.xyz/i/mr0oed92-rvcj4g.png)

本文档总结了 RAG (Retrieval-Augmented Generation) 的核心概念、关键组件以及如何构建本地知识库并接入大模型 Agent 的实战经验。通过 RAG，我们可以有效解决大模型的知识幻觉、知识滞后以及缺乏企业私有数据等痛点。

---

## 一、核心架构：RAG 的标准工作流

RAG 系统的核心目标是“先检索，再生成”，其标准流程主要包含以下三个核心阶段：

- **数据索引 (Indexing)**：将各种格式的私有文档（PDF、Markdown、Word 等）读取进来，切分成小块 (Chunks)，然后使用 Embedding 模型将其转化为向量，并存储到向量数据库中。
- **检索 (Retrieval)**：当用户提出问题时，同样使用 Embedding 模型将问题转化为向量，然后在向量数据库中进行相似度检索，召回最相关的文档块。
- **生成 (Generation)**：将用户的问题和检索到的相关文档块组装成 Prompt，交给大模型（如 GPT-4、Claude 等），让大模型基于这些背景知识生成准确的回答。

---

## 二、关键组件选型与实践

### 1. Embedding 模型与向量化原理

在 RAG 系统中，向量化（Embedding）是将非结构化数据转化为大模型能够理解的形式的关键步骤。

- **什么是向量化**：简单来说，向量化就是将文本（文字、词语或句子）映射为一个多维实数数组（即向量）。这个多维数组表示了该文本在语义空间中的位置。
- **语义相似度**：在语义空间中，含义相近的文本对应的向量距离会更近。例如，“苹果”和“香蕉”的向量距离，会比“苹果”和“汽车”的距离更近。这使得我们能通过数学计算（如余弦相似度、欧氏距离）来判断两段文本的相关性。
- **为什么需要向量化**：计算机无法直接理解文字，但可以快速处理数字和矩阵。通过向量化，我们将复杂的语义检索问题转化为了数学上的向量距离计算问题，从而实现了高效、精准的相似内容召回。
- **常见模型**：OpenAI 的 `text-embedding-3-small`/`large`，开源领域的 BGE (BAAI General Embedding)、M3E 等。

### 2. Token 计算与分词器 (Tokenizer)

在将文本送入大模型或进行 Embedding 之前，我们需要将其切分为 Token。Token 是大模型处理文本的基本单位，不同的模型往往使用不同的分词方案（Encoding）。

- **实战经验**：为了准确预估大模型 API 的消耗（通常按 Token 计费）并控制输入文本的长度以免超出模型的 Context Window，在本地通过代码进行 Token 计算是非常重要的一步。
- **工具推荐**：我们可以使用 `js-tiktoken` 库在 Node.js 环境下获取模型对应的分词方案并计算 Token。

**示例代码**（获取 `gpt-4o` 模型的 Encoding）：

```typescript
import { getEncodingNameForModel, getEncoding } from 'js-tiktoken'

const modelName = 'gpt-4o'
// 获取模型对应的分词编码方案名称，例如 'o200k_base'
const encodingName = getEncodingNameForModel(modelName)

console.log(encodingName);
```

### 3. 数据加载与文档拆分 (Loaders & Text Splitters)

在实际业务中，我们获取的数据往往是网页、PDF 或大段文本。直接将其进行向量化会导致上下文过长，因此需要加载并将其拆分为较小的“块”（Chunks）。

- **Document Loaders (数据加载器)**：用于将不同格式的外部数据转换为框架可识别的 `Document` 对象。例如，在代码中我们使用了 `CheerioWebBaseLoader`（依赖 `cheerio`）来直接从给定的网页 URL 获取特定选择器下的 HTML 内容，并转化为纯文本。

- **Text Splitters (文本拆分器)**：长文本需要切片。常用的有 `RecursiveCharacterTextSplitter`。
  - `chunkSize`: 设定切片的最大字符数（比如 500）。
  - `chunkOverlap`: 设定相邻切片之间的重叠字符数（比如 50），这是为了防止一句话在中间被切断而丢失上下文联系。
  - `separators`: 自定义按照段落、句号、感叹号等标点符号进行优先级切分。

### 4. 向量存储与检索 (Vector Stores & Retriever)

完成切分和 Embedding 后的数据需要存储起来，以便能够进行相似度搜索。

- **MemoryVectorStore**：在我们的演示代码中，使用了基于内存的向量存储库。它适合本地调试和快速验证。通过 `MemoryVectorStore.fromDocuments`，它会自动调用传入的 `embeddingModel` 把文本转为向量并存入内存。
- **Retriever (检索器)**：调用 `vectorStore.asRetriever({ k: 3 })` 可以把存储库转化为一个检索器接口，`k: 3` 表示当传入用户问题时，它会召回最相似的 3 个文档块 (Top-K 召回)。

### 5. 组装 Prompt 与 LLM 生成 (Prompt Assembly & Generation)

检索出相关文档（Context）后，我们需要把它们拼接成字符串，并结合用户的问题，组成最终喂给大模型（如 GPT-4）的 Prompt。

- **上下文格式化**：例如 `utils.ts` 中的 `formatDocumentsAsString` 方法，将多个检索到的文档数组拼接为一个带有 `[片段1]、[片段2]` 标记的长字符串。
- **防止幻觉**：在 Prompt 中，我们通常需要明确指示大模型：“如果背景知识中没有提及相关内容，请直接回答‘基于当前知识库我不知道’，千万不要编造答案”。这极大程度地遏制了大模型的“幻觉”（Hallucination）。
- **生成回答**：最后调用 `model.invoke(prompt)` 让大模型进行总结回答。整个从读取、向量化、检索到生成的 RAG 链路就此闭环。

---

![进阶流程图](https://api.cheatppf.xyz/i/mr1vwu7x-tyl7bu.png)

## 三、实战进阶：接入生产级向量库与电子书处理

随着数据量的增加，基于内存的 `MemoryVectorStore` 已无法满足需求，因此我们将项目升级为使用专业的向量数据库（如 Milvus），并打通了处理整本电子书（EPUB）的复杂链路。

### 1. Milvus 向量数据库接入与封装

在工业级 RAG 应用中，稳定且可扩展的向量数据库是核心基础设施。

- **客户端复用**：为了避免在每个任务中重复创建连接，我们将 `MilvusClient` 的实例化逻辑提取到了公共模块（如 `model.ts`）中，对外导出一个统一的 `createMilvusClient` 函数供整个项目复用。
- **集合与模式 (Collection & Schema)**：在存储复杂的业务数据时，不能只存向量和文本。在创建集合时，我们定义了丰富的元数据字段（如 `book_id`, `book_name`, `chapter_num`, `index` 等），这为后续进行基于标量的混合检索（如“仅搜索《长安的荔枝》第三章的内容”）打下了基础。
- **索引策略 (Indexing)**：我们使用了 `IVF_FLAT` 索引类型和 `COSINE` (余弦相似度) 距离算法，在保证精准度的同时兼顾检索效率。

### 2. 长文本解析：EPUB 电子书加载与清理

相较于纯文本或简单网页，解析整本电子书通常会面临更多环境和数据清洗问题。

- **动态依赖问题**：使用 LangChain 的 `EPubLoader` 读取电子书时，其底层实际上是动态依赖 `epub2`（用于解析 EPUB 目录和文件结构）以及 `html-to-text`（用于剥离 HTML 标签，清洗出干净的纯文本）。在开发过程中需注意主动补齐这些外部依赖。
- **按章加载 (`splitChapters`)**：利用 `EPubLoader` 提供的方法参数 `{ splitChapters: true }`，我们可以将一整本 200 多 KB 的书籍初步拆分为独立的章节，天然保留了书籍最原始的宏观逻辑结构。

### 3. 文档二次拆分与公共方法抽离

- **核心逻辑抽离**：我们将诸如 `getVector`（调用 Embedding 模型将文本转化为向量数组）的高频基础方法抽离到了 `utils.ts` 工具库中，使得各业务脚本的代码结构更加纯粹、高内聚。
- **为什么需要二次切分？** 尽管按章节加载保留了逻辑，但单章内容的长度动辄数千字，若直接交由 Embedding 模型转换，极易产生“特征失真”，并且召回时也会迅速占满大模型的上下文 Token 额度。
- **小说类切片（Chunking）的最佳实践**：对于小说或叙事类文本，我们继续使用 `RecursiveCharacterTextSplitter` 进行了细粒度的二次切割：
  - **`chunkSize: 500`**：500 字的切块是一个很好的“甜点区间”。它能容纳 2 到 3 个段落，既保证了剧情语义的饱满度，又足够聚焦。
  - **`chunkOverlap: 100`**：相较于说明文档，小说对于上下文的连贯性要求极高。将重叠度提升至 100 个字符，能有效防止人物对话或连贯的动作描写被生硬切断，使得最终被召回的多个文本片段在逻辑上依旧能平滑衔接。

### 4. 学习与实践推荐

在学习和实践 RAG 以及向量数据库的过程中，如果想要免去本地繁琐的数据库部署与环境配置，快速上手体验，**推荐大家使用 [Zilliz Cloud](https://zilliz.com/cloud) 来进行学习**。作为 Milvus 的原厂全托管云服务版本，它提供了开箱即用的高性能向量数据库体验，能够让你把更多精力专注在 RAG 核心链路的开发上，非常适合开发者进行测试以及快速验证想法。
