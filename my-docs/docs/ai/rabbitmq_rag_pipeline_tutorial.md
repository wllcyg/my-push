# 📘 AI 知识库与 RAG 异步消息管线（RabbitMQ）实战教学文档

> 本文档面向全栈/后端开发者，全面解析 **消息队列（Message Queue）基础理论**，以及其在 **AI 知识库与 RAG（检索增强生成）系统中的完整落地架构与代码实现**。

---

## 目录
- [一、 为什么 RAG 知识库系统必须使用 MQ？](#一-为什么-rag-知识库系统必须使用-mq)
- [二、 RabbitMQ 与 AMQP 核心基础概念](#二-rabbitmq-与-amqp-核心基础概念)
  - [1. 核心角色与模型](#1-核心角色与模型)
  - [2. 交换机类型（Exchange Types）](#2-交换机类型exchange-types)
  - [3. Connection 与 Channel 的区别](#3-connection-与-channel-的区别)
  - [4. 消息可靠性：持久化与 ACK / NACK 机制](#4-消息可靠性持久化与-ack--nack-机制)
- [三、 本项目 MQ 架构设计与数据流转](#三-本项目-mq-架构设计与数据流转)
  - [1. 架构总览图](#1-架构总览图)
  - [2. 文件目录与职责划分](#2-文件目录与职责划分)
- [四、 核心代码逐行精读](#四-核心代码逐行精读)
  - [1. 拓扑常量与消息载荷契约](#1-拓扑常量与消息载荷契约)
  - [2. 底层连接与驱动服务 (RabbitMqService)](#2-底层连接与驱动服务-rabbitmqservice)
  - [3. 生产者投递 (DocumentPipelinePublisher)](#3-生产者投递-documentpipelinepublisher)
  - [4. 消费者监听 (DocumentPipelineConsumer)](#4-消费者监听-documentpipelineconsumer)
- [五、 核心设计考量与高频面试/实战问题](#五-核心设计考量与高频面试实战问题)

---

## 一、 为什么 RAG 知识库系统必须使用 MQ？

在 RAG（Retrieval-Augmented Generation）知识库场景中，一篇文档发布后，需要经历以下一系列极耗 CPU/GPU 和网络资源的操作：
1. **长文本智能分块（Chunking）**：按段落/Markdown 语义切分为数百个 Chunk 块并计算重叠窗口。
2. **大模型向量化嵌入（Embedding）**：调用外部 AI 模型（如 OpenAI、Ollama 等）为每个 Chunk 计算高维稠密向量（耗时通常为 5s ~ 30s，且受接口 QPS 速率限制）。
3. **双路索引持久化**：分别写入 **Elasticsearch**（用于关键词 BM25 全文检索）与 **PostgreSQL pgvector / Milvus**（用于向量 ANN 余弦检索）。

### ❌ 同步模式的严重缺陷
如果发布文档采用同步调用，用户点击“发布”按钮后，HTTP 接口会卡死几十秒甚至直接触发网关 504 超时崩溃；且若同时导入 10 份大文件，瞬间高并发调用会把外部 Embedding API 或本地 GPU 显存瞬间打爆。

### ✅ 引入 MQ 后的异步流水线
```mermaid
sequenceDiagram
    autonumber
    actor User as 用户 / 前端
    participant DocSvc as DocumentService
    participant PG as PostgreSQL (元数据)
    participant Publisher as DocumentPipelinePublisher
    participant Broker as RabbitMQ 消息队列
    participant Consumer as DocumentPipelineConsumer
    participant Orchestrator as PipelineOrchestrator (RAG 管线)

    User->>DocSvc: POST /document/:id/publish (发布文档)
    DocSvc->>PG: 更新状态为 Published，记录 publishTime
    DocSvc->>Publisher: afterPublish(doc)
    Publisher->>Broker: 投递 ReindexMessage (仅需 2~5ms)
    DocSvc-->>User: ⚡ 立即响应 200 OK（用户体验丝滑）

    Note over Broker,Consumer: 后台异步解耦削峰消费
    Broker->>Consumer: 推送消息
    Consumer->>Orchestrator: handleRagReindex(type, documentIds)
    Note over Orchestrator: 1. 查 Mongo 正文<br/>2. 文本分块 Chunking<br/>3. Embedding 向量化<br/>4. 写入 ES 与 pgvector
    Consumer->>Broker: ch.ack(msg) 确认出队
```

**引入 MQ 带来的核心收益：**
1. **毫秒级接口响应**：发布接口只做状态变更与发牌，立即返回前端。
2. **削峰限流与平滑消费**：突发批量导入时，消息在队列中有序排队，消费者按设定的并发度稳步消化，保护下游数据库与 AI 接口。
3. **容错重试与断点续传**：外部 Embedding 接口网络抖动时支持重试，严重错误可进入死信队列（DLQ），避免丢失任务。
4. **管线解耦**：未来如需新增“知识图谱抽取（KG）”或“全文摘要生成”，只需增加新的消费者订阅交换机即可，无需改动现有业务代码。

---

## 二、 RabbitMQ 与 AMQP 核心基础概念

RabbitMQ 是基于 **AMQP（Advanced Message Queuing Protocol，高级消息队列协议）** 构建的企业级消息中间件。

### 1. 核心角色与模型

```
[Producer 生产者] ──发送消息(带 RoutingKey)──> [Exchange 交换机]
                                                      │
                                           根据 Binding 规则路由
                                                      │
                                                      ▼
[Consumer 消费者]  <───拉取/推送消息 (带 ACK)──── [Queue 队列]
```

* **Producer（生产者）**：产生并向 RabbitMQ 发送消息的应用程序（如本系统的 [`DocumentPipelinePublisher`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/document-pipeline.publisher.ts)）。
* **Exchange（交换机）**：负责接收生产者的消息，并根据**路由规则（Binding 绑定关系与 Routing Key 路由键）**将消息分发到对应的队列中。
* **Queue（队列）**：实际存储消息的缓冲区，消费者直接从队列中监听并取出消息。
* **Consumer（消费者）**：连接到队列并处理消息的应用程序（如本系统的 [`DocumentPipelineConsumer`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/document-pipeline.consumer.ts)）。
* **Routing Key（路由键）**：生产者发送消息时附带的“标签”（类似于邮件上的邮政编码）。
* **Binding（绑定）**：交换机与队列之间的关联关系（类似于“把某个邮编的信件投放到对应邮箱”）。

---

### 2. 交换机类型（Exchange Types）

| 交换机类型 | 路由规则 | 典型应用场景 |
| :--- | :--- | :--- |
| **Direct** | 完全匹配 Routing Key（如 `document.published` 必须 100% 精确一致） | 点对点精确分发 |
| **Topic (推荐)** | 支持通配符匹配（`*` 匹配单级单词，`#` 匹配零个或多个单词） | **RAG 系统最佳选择**（支持按规则多维度扩展消费者） |
| **Fanout** | 忽略 Routing Key，将消息无差别广播给所有绑定的队列 | 发布/订阅广播（如实时通知、群聊消息） |
| **Headers** | 根据消息头（Headers）的 Key-Value 属性匹配，不看 Routing Key | 复杂多条件属性匹配 |

---

### 3. Connection 与 Channel 的区别

* **Connection（物理连接）**：
  * 客户端与 RabbitMQ Broker 之间建立的 **TCP 物理连接**。
  * 每次握手和断开非常消耗 CPU 和网络资源，属于**重量级连接**。
* **Channel（信道/虚拟通道）**：
  * 在单个 Connection TCP 连接上开辟的多条**虚拟轻量级信道**。
  * 所有实际的业务操作（如 `assertQueue` 声明队列、`publish` 发消息、`consume` 监听消费）都是在 Channel 上执行的。
  * **优势**：极大减少 TCP 连接数量，支持极高的并发吞吐。

---

### 4. 消息可靠性：持久化与 ACK / NACK 机制

#### ① 消息持久化（Durability）
* **交换机持久化**：`assertExchange(name, 'topic', { durable: true })`（MQ 重启后交换机依然存在）。
* **队列持久化**：`assertQueue(name, { durable: true })`（MQ 重启后队列依然存在）。
* **消息持久化**：`publish(exchange, rk, payload, { persistent: true })`（消息写入磁盘，MQ 崩溃重启后消息不丢失）。

#### ② 消费确认机制（ACK / NACK）
* **`ch.ack(msg)` (Acknowledge)**：
  * 业务处理成功后，手动通知 RabbitMQ 将该消息从队列中真正删除。
* **`ch.nack(msg, requeue = false, multiple = false)` (Negative Acknowledge)**：
  * 业务抛出异常时拒绝该消息。
  * **关键设计**：必须设置 `requeue = false`（不重回队列），否则失败的消息会立即返回队头并被重复拉取，导致无限抛错死循环！

---

## 三、 本项目 MQ 架构设计与数据流转

### 1. 架构总览图

```mermaid
flowchart TD
    subgraph WebAPI ["1. 业务接入层"]
        A["POST /document/:id/publish"] --> B["DocumentService.publish()"]
    end

    subgraph Producer ["2. 消息生产者"]
        B -->|写入 Postgres 发布状态| C["DocumentPipelinePublisher.afterPublish()"]
        C -->|构造 ReindexMessage| D["RabbitMqService.publish()"]
    end

    subgraph Broker ["3. RabbitMQ Broker"]
        D -->|Exchange: rag.reindex.exchange<br/>RoutingKey: rag.reindex.by_ids| E(("Topic Exchange"))
        E -->|Binding: rag.reindex.by_ids| F["Queue: kh.rag.reindex.queue"]
    end

    subgraph Consumer ["4. 消息消费者与 RAG 管线"]
        F -->|push 消息| G["DocumentPipelineConsumer.handleRag()"]
        G -->|反序列化 Payload| H["PipelineOrchestrator.handleRagReindex()"]
        H -->|1. 读 Mongo 正文| I["DocumentContent (MongoDB)"]
        H -->|2. 文本分块| J["ChunkingService"]
        H -->|3. 向量化| K["EmbeddingService"]
        H -->|4. 写入倒排| L["Elasticsearch"]
        H -->|5. 写入向量| M["PostgreSQL (pgvector)"]
        G -->|处理成功| N["ch.ack(msg) 出队"]
    end

    style WebAPI fill:#e3f2fd,stroke:#1565c0
    style Producer fill:#e8f5e9,stroke:#2e7d32
    style Broker fill:#fff3e0,stroke:#e65100
    style Consumer fill:#f3e5f5,stroke:#6a1b9a
```

### 2. 文件目录与职责划分

```
src/mq/
├── mq.constants.ts                 # 拓扑常量定义（交换机、队列名、路由键）
├── rabbitmq.service.ts             # 核心底层驱动（基于 amqp-connection-manager 封装）
├── document-pipeline.publisher.ts  # 业务生产者（组装任务并投递 MQ）
├── document-pipeline.consumer.ts   # 业务消费者（监听队列并分发至编排器）
├── mq.module.ts                    # 全局 MQ 模块注册
└── messages/
    └── pipeline.messages.ts        # 消息载荷契约接口（ReindexMessage）
```

---

## 四、 核心代码逐行精读

### 1. 拓扑常量与消息载荷契约

#### [`src/mq/mq.constants.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/mq.constants.ts)
```typescript
/** RAG 重建索引交换机（topic） */
export const RAG_REINDEX_EXCHANGE = 'rag.reindex.exchange';

/** 本服务消费的队列（带 kh. 前缀避免同机多项目命名冲突） */
export const RAG_REINDEX_QUEUE = 'kh.rag.reindex.queue';

/** 路由键：按文档 ID 重建 */
export const RAG_RK_BY_IDS = 'rag.reindex.by_ids';
```

#### [`src/mq/messages/pipeline.messages.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/messages/pipeline.messages.ts)
```typescript
export type ReindexType = 'BY_DOC_IDS';

export interface ReindexMessage {
  taskId: string;          // 唯一任务跟踪 ID (UUID)
  type: ReindexType;       // 任务类型
  documentIds?: string[];  // 待处理文档 ID 数组
}
```

> **设计要点**：
> * 消息中**只传递轻量级的 ID 数组**，不传递庞大的正文字符串，避免网络带宽浪费与脏数据风险。
> * `documentIds` 为数组，一套消费者代码天然兼容“单篇发布”与“批量重建”。

---

### 2. 底层连接与驱动服务 (`RabbitMqService`)

[`src/mq/rabbitmq.service.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/rabbitmq.service.ts) 是最核心的底层引擎：

```typescript
@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: AmqpConnectionManager | null = null;
  private channel: ChannelWrapper | null = null;
  private readonly handlers = new Map<string, MessageHandler>(); // 消费者注册表

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672';
    this.connection = amqp.connect([url]); // 建立自动重连物理连接
    
    // 监听断线与重连事件
    this.connection.on('connect', () => this.logger.log('RabbitMQ 已连接'));
    this.connection.on('disconnect', (err) => this.logger.warn(`RabbitMQ 断开: ${err}`));

    // 创建虚拟 Channel，并在 Channel 准备完毕后执行 setup
    this.channel = this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await this.assertTopology(ch); // 声明拓扑
        await this.bindConsumers(ch);  // 绑定所有已注册的消费者
      },
    });

    // 15 秒连接超时保护（非阻塞设计：超时只打 warning，不崩溃 Nest 进程）
    try {
      await Promise.race([
        this.channel.waitForConnect(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('超时')), 15000)),
      ]);
    } catch (err) {
      this.logger.warn(`RabbitMQ 异步连接中（启动未阻塞）`);
    }
  }

  /** 声明核心拓扑 */
  private async assertTopology(ch: ConfirmChannel) {
    await ch.assertExchange(RAG_REINDEX_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(RAG_REINDEX_QUEUE, { durable: true });
    await ch.bindQueue(RAG_REINDEX_QUEUE, RAG_REINDEX_EXCHANGE, RAG_RK_BY_IDS);
  }

  /** 消息投递（带持久化） */
  async publish(exchange: string, routingKey: string, payload: unknown): Promise<boolean> {
    if (!this.channel) return false;
    await this.channel.publish(exchange, routingKey, payload, {
      contentType: 'application/json',
      persistent: true, // 磁盘持久化
    });
    return true;
  }

  /** 消费者绑定与手动 ACK/NACK 控制 */
  private async bindConsumers(ch: ConfirmChannel) {
    for (const [queue, handler] of this.handlers.entries()) {
      await ch.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          await handler(msg);
          ch.ack(msg); // 消费成功，确认出队
        } catch (error) {
          this.logger.error(`消费失败: ${error}`);
          ch.nack(msg, false, false); // 消费失败，拒绝且不重回队列（防死循环）
        }
      });
    }
  }
}
```

---

### 3. 生产者投递 (`DocumentPipelinePublisher`)

[`src/mq/document-pipeline.publisher.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/document-pipeline.publisher.ts)：

```typescript
@Injectable()
export class DocumentPipelinePublisher {
  constructor(private readonly rabbit: RabbitMqService) {}

  /** 发布成功后调用 */
  async afterPublish(document: DocumentEntity) {
    const message: ReindexMessage = {
      taskId: randomUUID(), // 生成全链路 TraceId
      type: 'BY_DOC_IDS',
      documentIds: [document.id],
    };

    const ok = await this.rabbit.publish(
      RAG_REINDEX_EXCHANGE,
      RAG_RK_BY_IDS,
      message,
    );
    this.logger.log(`RAG 重建索引${ok ? '已投递' : '投递失败'}：docId=${document.id}, taskId=${message.taskId}`);
  }
}
```

---

### 4. 消费者监听 (`DocumentPipelineConsumer`)

[`src/mq/document-pipeline.consumer.ts`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/mq/document-pipeline.consumer.ts)：

```typescript
@Injectable()
export class DocumentPipelineConsumer {
  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly orchestrator: PipelineOrchestrator,
  ) {
    // 在构造函数阶段注册，确保早于 RabbitMqService.onModuleInit 的 bindConsumers
    this.rabbit.registerHandler(RAG_REINDEX_QUEUE, (msg) => this.handleRag(msg));
  }

  private async handleRag(msg: ConsumeMessage) {
    const body = JSON.parse(msg.content.toString('utf8')) as ReindexMessage;
    this.logger.log(`[RAG] 收到任务: type=${body.type}, taskId=${body.taskId}`);
    
    // 交接给真正的 RAG 核心编排服务
    await this.orchestrator.handleRagReindex(body.type, body.documentIds);
  }
}
```

---

## 五、 核心设计考量与高频面试/实战问题

### Q1: 为什么注册消费者要在 `constructor` 里执行，而不是 `onModuleInit`？
* **解答**：NestJS 启动时，所有 Provider 的 `constructor` 会全部先执行完，之后才统一触发各个模块的 `onModuleInit` 钩子。在 `constructor` 中执行 `registerHandler` 可以 **100% 保证** `RabbitMqService.onModuleInit` 遍历 `handlers` Map 时所有消费者均已注册，绝不会因模块初始化先后顺序问题导致漏绑队列。

### Q2: 为什么 `ch.nack(msg, false, false)` 第二个参数要设为 `false`（不重回队列）？
* **解答**：如果设为 `requeue = true`，当某篇文档由于正文格式异常导致分块代码抛错时，失败消息会立刻重新回到队列头部；消费者会不断重新拉取、报错、重回队列，瞬间导致 **CPU 100% 并陷入死循环**。设为 `false` 后可丢弃或自动流入死信队列（DLQ），保护服务稳定。

### Q3: 为什么即使 MQ 投递失败，也不回滚 Postgres 上的文档发布状态？
* **解答**：核心业务与衍生异步任务分离原则。文档发布成功已持久化在关系数据库中，MQ 只是触发后台建立索引的通道。若因网络瞬时抖动导致投递失败，不应让前台用户感知“发布失败”；系统可以通过后台“重新索引”按钮或定时补偿 Job 随时重新触发索引构建。

---

## 🎯 总结与后续步骤

到目前为止，整个异步消息队列骨架已经完整闭环。下一阶段的核心工作为实现 **[`PipelineOrchestrator`](https://github.com/wllcyg/ai-rag-learning/blob/main/src/pipeline/pipeline.orchestrator.ts)** 中的 **RAG 核心管线**：
1. **文本智能分块服务（Chunking Service）**
2. **Embedding 向量化服务（接入大模型）**
3. **Elasticsearch 倒排索引 + pgvector 向量索引写入**
