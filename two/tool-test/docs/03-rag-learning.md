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
