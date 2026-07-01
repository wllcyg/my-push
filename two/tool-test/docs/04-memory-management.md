# Agent 记忆管理与多轮对话实战总结

## 一、记忆管理 (Memory Management) 的核心策略

在构建能够处理长上下文或多轮对话的 Agent 系统时，记忆管理是至关重要的一环。单纯依赖大模型自身的 Context Window 往往无法满足长时间交互的需求，甚至会导致 API 成本激增和响应变慢。因此，我们需要引入不同的记忆策略来维持对话的连贯性：

![记忆策略全景图](https://api.cheatppf.xyz/i/mr27xxpv-svym0z.png)

### 1. 记忆留存的最佳实践

对于多轮对话场景，我们总结了以下几种记忆处理机制的最佳实践：

- **`BufferMemory` (完整缓冲记忆)**：最基础的记忆形式。它会完整保存历史对话中的每一句话。虽然能最大程度保留上下文细节，但在长对话中极易达到大模型的 Token 上限，通常仅适用于短促、任务明确的一次性会话。
- **`ConversationSummaryMemory` (摘要记忆)**：在每次对话轮次后，让大模型在后台对先前的对话内容进行总结和压缩。这种策略能够有效控制 Token 的消耗速度，并在保留核心意图的同时抛弃冗余细节，非常适合闲聊或长期运行的 Agent。
- **`VectorStoreRetrieverMemory` (向量检索记忆)**：当历史记忆积累到一定规模时，可以将其视作一种长期的"外部存储"。我们将历史对话切片并转化为向量存入数据库，当用户提出新问题时，通过计算相似度召回最相关的历史片段，从而实现真正的长时记忆（Long-term Memory）。

---

## 二、方案一：按消息数量截断 (Count-based Truncation)

### 核心思路

最简单直接的截断策略：当历史消息的**条数**超过设定的 `maxMessage` 阈值时，只保留最新的 N 条，将更早的消息直接丢弃。

![滑动窗口截断示意图](https://api.cheatppf.xyz/i/mr27yqce-yzzeca.png)

### 关键代码

**文件**：`src/memory/truncation-memory.ts`

```typescript
const maxMessage = 4

// 从历史中取出所有消息
let allMessages = await history.getMessages()

// 开始截断：只保留最后 maxMessage 条
const trimmedMessage = allMessages.slice(-maxMessage)
```

### 参数说明

| 参数 | 类型 | 说明 |
|---|---|---|
| `maxMessage` | `number` | 保留的最大消息条数。超出部分从队列头部直接丢弃。 |

### 适用场景

- 对话主题切换频繁、早期历史无参考价值的场景
- 对计算资源有严格限制、需要极低延迟的场景
- 早期快速原型验证，不需要精确 Token 控制时

### ⚠️ 局限性

按条数截断**不够精确**。一条消息可能包含几个字，也可能包含数千字。在内容差异较大的对话中，可能出现截断后依然超出 Token 预算，或截断过于激进导致上下文断裂的问题。

---

## 三、方案二：按 Token 数量精确截断 (Token-based Truncation)

### 核心思路

使用 OpenAI 官方的分词器 `tiktoken`，对历史消息做**精确的 Token 计数**，然后通过 LangChain 内置的 `trimMessages` 方法，按照真实的 Token 消耗来进行截断，保证上下文永远不会超出大模型的预算。

![Token 预算前后对比图](https://api.cheatppf.xyz/i/mr27zo6s-q9tyk1.png)

### 关键代码

**文件**：`src/memory/truncation-memory.ts`

```typescript
import { getEncoding } from "js-tiktoken";
import { trimMessages } from "@langchain/core/messages";

const maxTokens = 50
const enc = getEncoding("cl100k_base")  // GPT-4 / GPT-4o 系列通用分词器

// 自定义 Token 计数器
function countTokens(messages: any[], encoder: any) {
    let total = 0
    for (const msg of messages) {
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)
        total += encoder.encode(content).length
    }
    return total
}

// 调用 LangChain 内置截断方法
const trimMsg = await trimMessages(allMessage, {
    maxTokens,
    strategy: 'last',        // 保留最新的消息
    tokenCounter: async (msgs) => countTokens(msgs, enc)
})
```

### 参数说明

| 参数 | 类型 | 说明 |
|---|---|---|
| `maxTokens` | `number` | Token 预算上限，超出这个数量的旧消息将被裁剪 |
| `strategy` | `'last'` \| `'first'` | `'last'` 保留最新消息；`'first'` 保留最早消息 |
| `tokenCounter` | `function` | 自定义计数函数，接收消息数组返回总 Token 数 |
| `includeSystem` | `boolean` | 设为 `true` 时，System 提示词永远不会被截断（强烈推荐） |
| `getEncoding("cl100k_base")` | - | 对应 GPT-4、GPT-4o 使用的分词方案 |

### 实际运行结果

```
=== 按照 Token 截断结果 ===
原始消息数: 5
截断后消息数: 2
截断后的消息详情:
[
  HumanMessage { content: '请列出中国的前三个城市' },
  AIMessage { content: '中国的前三个城市是北京,上海,广州.' }
]
```

### 💡 进阶技巧：永远保留 System 提示词

```typescript
const trimMsg = await trimMessages(allMessage, {
    maxTokens,
    strategy: 'last',
    tokenCounter: async (msgs) => countTokens(msgs, enc),
    includeSystem: true   // ✅ 防止 AI "忘掉自己是谁"
})
```

---

## 四、方案三：AI 总结记忆 (Summarization Memory)

### 核心思路

截断策略的本质是"**丢弃**"，而总结策略则是"**压缩**"。当历史消息超出阈值时，不直接抛弃旧消息，而是调用大模型对旧消息进行摘要，将数千字的历史对话浓缩成几句话，然后以 `SystemMessage` 的形式注入回历史，以极低的 Token 成本保留了对话的核心语义。

![对话压缩与重建流程图](https://api.cheatppf.xyz/i/mr280hl3-b3c6uy.png)

### 核心总结函数

**文件**：`src/memory/summarization-memory.ts`

```typescript
async function summarizeHistory(messages: any[]) {
    if (messages.length == 0) return ''

    // getBufferString：将消息对象数组转为大模型可读的纯文本
    const conversationText = getBufferString(messages, '用户', '助手')
    const summaryPrompt = `
    请总结以下对话的核心内容,保留重要信息

    ${conversationText}

    总结:
    `
    const summaryResponse = await model.invoke([new SystemMessage(summaryPrompt)])
    return summaryResponse.content
}
```

### `getBufferString` API 说明

`getBufferString` 是 LangChain 提供的工具函数，专门将消息对象数组格式化为大模型可读的纯文本：

```typescript
// 原始：LangChain 消息对象数组
[HumanMessage("你好"), AIMessage("你好！有什么可以帮你的？")]

// 转换后：纯文本字符串（便于放入 Prompt）
// "用户: 你好\n助手: 你好！有什么可以帮你的？"
getBufferString(messages, '用户', '助手')
```

### 子方案 A：按消息数量触发总结

```typescript
if (allMessage.length >= maxMessages) {
    const recent = allMessage.slice(-keepRecent)           // 保留最新 N 条
    const messagesToSummarize = allMessage.slice(0, -keepRecent)  // 旧消息送去总结

    const summary = await summarizeHistory(messagesToSummarize)

    await history.clear()
    await history.addMessage(new SystemMessage(summary))
}
```

### 子方案 B：按 Token 数量触发总结（生产环境推荐）

```typescript
const totalTokens = countTokens(allMessage)

if (totalTokens > maxTokens) {
    const recent = allMessage.slice(-keepRecentCount)
    const messagesToSummarize = allMessage.slice(0, -keepRecentCount)

    const summary = await summarizeHistory(messagesToSummarize)

    await history.clear()
    await history.addMessage(new SystemMessage(`以下是之前对话的摘要:\n${summary}`))
    for (const msg of recent) {
        await history.addMessage(msg)
    }
}
```

### 两种触发方式对比

| 对比维度 | 按消息数量触发 | 按 Token 数量触发 |
|---|---|---|
| 触发条件 | `length >= maxMessages` | `totalTokens > maxTokens` |
| 精准度 | 低（忽略消息长短差异） | 高（精确控制 API 成本） |
| 实现复杂度 | 简单 | 需引入 `js-tiktoken` |
| 推荐场景 | 快速原型 | 生产环境 |

---

## 五、方案四：向量数据库长期记忆 (Vector Store Memory)

### 核心思路

前三种方案本质上都是"**短期记忆**"——每次会话结束，数据就消失了。向量存储记忆则实现了真正的"**长期记忆**"：将历史对话持久化存储到向量数据库（如 Zilliz Cloud / Milvus），在未来新的会话中，通过**语义相似度搜索**，精准召回与当前问题最相关的历史对话片段。

![向量长期记忆检索架构图](https://api.cheatppf.xyz/i/mr280hl3-b3c6uy.png)

### 数据库集合设计

**文件**：`src/memory/insert-vector.ts`

```typescript
await client.createCollection({
    collection_name: CONVER_COLLECTION_NAME,
    fields: [
        { name: 'id',        data_type: DataType.VarChar,     max_length: 50,   is_primary_key: true },
        { name: 'vector',    data_type: DataType.FloatVector, dim: VECTOR_DIM },   // 对话内容的向量嵌入
        { name: 'content',   data_type: DataType.VarChar,     max_length: 5000 }, // 对话原文
        { name: 'round',     data_type: DataType.Int64 },                         // 第几轮对话
        { name: 'timestamp', data_type: DataType.VarChar,     max_length: 100 }   // 时间戳
    ]
})
```

### 字段设计说明

| 字段名 | 类型 | 作用 |
|---|---|---|
| `id` | `VarChar(50)` | 每条对话的唯一标识，如 `conv_001` |
| `vector` | `FloatVector(1024)` | 对话内容的向量表示，用于相似度检索 |
| `content` | `VarChar(5000)` | 对话原文，检索命中后返回给大模型 |
| `round` | `Int64` | 对话轮次，可用于按时间范围过滤 |
| `timestamp` | `VarChar(100)` | ISO 时间戳，便于排序和追溯 |

### 写入流程

```typescript
for (const conv of conversations) {
    const vector = await getVector(conv.content)  // 调用 Embedding 模型生成向量
    insertData.push({ ...conv, vector })
}

await client.insert({
    collection_name: CONVER_COLLECTION_NAME,
    data: insertData
})
```

---

## 六、四种方案综合对比

![四种方案对比雷达图](https://api.cheatppf.xyz/i/mr2819xe-j9yvyr.png)

| 方案 | 实现难度 | 信息保留 | Token 节省 | 跨会话持久化 | 适用场景 |
|---|---|---|---|---|---|
| 按数量截断 | ⭐ | 低 | 中 | ❌ | 快速原型、短对话 |
| 按 Token 截断 | ⭐⭐ | 低 | 高 | ❌ | 精确控制成本 |
| AI 摘要压缩 | ⭐⭐⭐ | 中（语义保留） | 极高 | ❌ | 长时闲聊 Agent |
| 向量数据库 | ⭐⭐⭐⭐ | 高（精确召回） | 极高 | ✅ | 个人助手、知识库 |

---

## 七、学习与实践推荐

在学习和实践记忆管理以及向量数据库的过程中，如果想要免去本地繁琐的数据库部署与环境配置，快速上手体验，**推荐大家使用 [Zilliz Cloud](https://zilliz.com/cloud) 来进行学习**。作为 Milvus 的原厂全托管云服务版本，它提供了开箱即用的高性能向量数据库体验，能够让你把更多精力专注在记忆管理核心链路的开发上，非常适合开发者进行测试以及快速验证想法。
