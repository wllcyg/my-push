# 企业级 AI 知识库 Agent 工具箱 (Tools Hub) 扩充与扩展指南

> **文档目标**：本文档旨在规划与规范企业级 AI 知识库 Agent 系统中可装配的工具箱 (Tools Hub)。通过扩展 Tool Calling 体系，使 Agent 从单一的“文档向量检索”升级为具备**实时联网、全文查阅、数据统计、精准计算与办公协同**的多功能智能体。

---

## 📌 一、 常用 Tools 矩阵总览 (Tool Matrix)

根据企业实际业务场景，推荐构建以下 5 大维度的 Agent 工具箱：

| 工具名称 (Tool Name) | 工具分类 | 核心功能与职责 | 建议优先级 | 状态 |
| :--- | :--- | :--- | :---: | :---: |
| `knowledge_retriever` | 知识检索 | 基于 `pgvector` 密集向量相似度检索知识库切片 | **P0** | 🟢 已实现 |
| `document_detail_reader`| 文档读取 | 根据 `document_id` 读取完整原始 Markdown 正文，解决切片断章取义问题 | **P0** | ⌛ 待扩充 |
| `web_search` | 联网搜索 | 接入 Tavily / Bocha / SerpAPI，在本地知识库查无结果时补充实时互联网知识 | **P1** | ⌛ 待扩充 |
| `document_list_search`  | 目录筛选 | 按部门、分类、标签或更新时间筛选知识库文档列表 | **P1** | ⌛ 待扩充 |
| `calculator` | 精准计算 | 基于 JS/Python 引擎执行复杂的浮点算术与财务计算，消除 LLM 算术幻觉 | **P2** | ⌛ 待扩充 |
| `db_metrics_query` | 数据分析 | 执行只读统计 SQL，回答知识库文档量、浏览量、部门归档量等指标问题 | **P2** | ⌛ 待扩充 |
| `feishu_notifier` / `dingtalk_webhook` | 办公协同 | 接入飞书/钉钉/企微 Webhook，支持一键发送总结消息或创建故障工单 | **P3** | ⌛ 待扩充 |

---

## 🚀 二、 核心 Tools 规范与实现范例

所有工具统一采用 LangChain `@langchain/core/tools` 的 `DynamicStructuredTool` 配合 `Zod` 进行严格的输入参数校验。

### 1. `document_detail_reader` (全文查阅工具)

当向量切片无法提供完整上下文（如用户要看整篇规范或全篇总结）时，Agent 调用此工具调取 MongoDB 或 R2 中的完整 Markdown。

```typescript
// src/agent/tools/document-detail-reader.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DocumentService } from '../../document/document.service';

export function createDocumentDetailReaderTool(documentService: DocumentService) {
  return new DynamicStructuredTool({
    name: 'document_detail_reader',
    description:
      '当向量检索到的切片不够完整，或者用户明确要求阅读/总结某篇文档的全篇正文时，调用此工具传入 document_id 读取该文档的完整 Markdown 内容。',
    schema: z.object({
      documentId: z.string().describe('目标的文档 ID (bigint 字符串)'),
    }),
    func: async ({ documentId }) => {
      try {
        const fullContent = await documentService.getDocumentFullContent(documentId);
        if (!fullContent) return `未找到 ID 为 ${documentId} 的文档正文。`;
        // 限制最大返回字符数，防止超长打爆 上下文
        return fullContent.slice(0, 12000);
      } catch (error) {
        return `读取完整文档失败: ${(error as Error).message}`;
      }
    },
  });
}
```

---

### 2. `web_search` (实时联网搜索工具)

本地知识库搜不到时，自动触发互联网搜索补充最新资讯与技术文档。

```typescript
// src/agent/tools/web-search.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createWebSearchTool() {
  return new DynamicStructuredTool({
    name: 'web_search',
    description:
      '当本地企业知识库中未检索到相关内容，或者用户询问最新外部新闻、实时技术文档、开源库最新版本时调用此工具进行互联网搜索。',
    schema: z.object({
      query: z.string().describe('用于搜索引擎检索的关键词或简短短语'),
    }),
    func: async ({ query }) => {
      try {
        // 示例：接入 Tavily / Bocha / SerpAPI 接口
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return '未配置联网搜索 API Key。';

        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, query, max_results: 3 }),
        });
        const data = await res.json();
        return data.results.map((r: any) => `【来源】${r.title} (${r.url}):\n${r.content}`).join('\n\n');
      } catch (error) {
        return `联网搜索异常: ${(error as Error).message}`;
      }
    },
  });
}
```

---

### 3. `calculator` (精确计算器工具)

消除 LLM 算术幻觉，保证财务与报表数据 100% 精确。

```typescript
// src/agent/tools/calculator.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createCalculatorTool() {
  return new DynamicStructuredTool({
    name: 'calculator',
    description:
      '用于执行精确的数学算术表达式计算（如加减乘除、乘方、百分比、税率或报表数据汇总计算）。当涉及具体数字计算时必须调用此工具。',
    schema: z.object({
      expression: z.string().describe('需要计算的标准数学表达式，例如: "(12500 * 0.06) + 320"'),
    }),
    func: async ({ expression }) => {
      try {
        // 安全沙箱求值或使用 mathjs 库
        const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
        // eslint-disable-next-line no-eval
        const result = Function(`"use strict"; return (${sanitized})`)();
        return `计算结果: ${result}`;
      } catch (error) {
        return `计算表达式语法错误: ${(error as Error).message}`;
      }
    },
  });
}
```

---

### 4. `dingtalk_notifier` (办公协同通知工具)

```typescript
// src/agent/tools/dingtalk-notifier.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createDingTalkNotifierTool() {
  return new DynamicStructuredTool({
    name: 'dingtalk_notifier',
    description:
      '当用户明确要求将某些总结内容、会议要点或告警工单发送到钉钉/飞书工作群时调用此工具。',
    schema: z.object({
      title: z.string().describe('通知标题'),
      content: z.string().describe('通知 Markdown 文本正文'),
    }),
    func: async ({ title, content }) => {
      try {
        const webhookUrl = process.env.DINGTALK_WEBHOOK_URL;
        if (!webhookUrl) return '未配置工作群 Webhook 地址。';

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: { title, text: `### ${title}\n\n${content}` },
          }),
        });
        return '已成功将通知消息发送至工作群！';
      } catch (error) {
        return `消息发送失败: ${(error as Error).message}`;
      }
    },
  });
}
```

---

## 🛠️ 三、 在 Agent 架构中的集成装配指引

在 [agent.service.ts](file:///d:/self/my-push/enterprise-knowledge-base/src/agent/agent.service.ts) 的 `onModuleInit()` 钩子中，可以非常优雅地将多个工具同时注册进 LangGraph 的 `ToolNode` 与 LLM 绑定中：

```typescript
// src/agent/agent.service.ts

onModuleInit() {
  // 1. 实例化各个工具
  const retrieverTool = createKnowledgeRetrieverTool(this.embeddingService, this.dataSource);
  const detailReaderTool = createDocumentDetailReaderTool(this.documentService);
  const webSearchTool = createWebSearchTool();
  const calculatorTool = createCalculatorTool();

  // 2. 汇总工具列表
  const tools = [
    retrieverTool,
    detailReaderTool,
    webSearchTool,
    calculatorTool,
  ];

  // 3. 统一绑定至主 LLM 模型与 StateGraph ToolNode
  const llmWithTools = this.mainLlm.bindTools(tools);
  const toolsNode = new ToolNode(tools);

  // 4. 构建 StateGraph 保持不变，Workflow 将自动支持多工具决策与调用
  const workflow = new StateGraph(AgentState)
    .addNode('intent_router', intentNode)
    .addNode('rag_agent', callRagNode)
    .addNode('direct_agent', callDirectNode)
    .addNode('tools', toolsNode)
    // ...
}
```

---

## 🛡️ 四、 安全防护与最佳实践 (Guardrails)

1. **权限与二次确认 (Human-in-the-loop)**：对于带有写操作或发送外部消息的工具（如 `dingtalk_notifier`），应在前端或 Agent 节点中增加操作确认提示。
2. **上下文流控限制 (Context Control)**：对于返回大文本的工具（如 `document_detail_reader`），必须使用 `.slice(0, MAX_CHARS)` 截断，防止打爆大模型上下文窗口。
3. **安全沙箱 (Sanitizer)**：计算器与 SQL 工具必须强校验只读逻辑或在安全沙箱中执行，防止注入攻击。
4. **Langfuse 链路上报**：工具执行节点将自动透传 `RunnableConfig`，在 Langfuse 控制台可清晰追踪每次 Tool Call 的输入输出与耗时。
