# 企业级 AI 知识库系统 (Enterprise Knowledge Hub) 架构演进与完善规划书

> **文档目标**：本规划书旨在对标 Dify、RAGFlow 等全球顶级开源 RAG 平台，梳理当前系统已具备的坚实基建，并系统化规划未来在**高级检索算法、多级知识组织、AI 问答交互以及工程化运维**四大维度的完善与演进路径。

---

## 📌 一、 当前系统基础设施评估 (Current Status)

目前系统已构建了标准的工业级 RAG 下半场（文档解析、存储与向量化 Pipeline）：

| 维度 | 当前技术实现 | 评价与优势 |
| :--- | :--- | :--- |
| **存储架构** | PostgreSQL (`pgvector`) + MongoDB Atlas + Cloudflare R2 | **多模态解耦**：索引与正文分离，高并发且省内存 |
| **异步解耦** | NestJS + RabbitMQ (Topic Exchange) | **高吞吐抗压**：主流程秒回 `201 Parsing`，后台 Worker 异步处理 |
| **容灾与稳定性** | 自动降级解析 + 数据库启动自愈 + API 自动分批 (Batching) | **鲁棒性强**：无畏 MQ 宕机或第三方 API 限制 |
| **文本处理** | 自动 Markdown 解析 + 智能段落切分 + 滑动重叠窗口 (`Overlap`) | **切片规范**：有效降低文本切割造成的语义中断 |

---

## 🚀 二、 四大核心完善与演进规划 (Evolution Roadmap)

为将系统提升至 95+ 分的商业大厂级水平，规划以下四个演进阶段：

### 阶段 1：高级检索与算法增强 (Advanced RAG Pipeline) —— 解决“搜不准”

目前仅支持单路纯向量相似度搜索，面对专有名词、工号、产品型号时精准度不足。

#### 1.1 混合检索 (Hybrid Search)
- **语义路 (Semantic Search)**：PostgreSQL `pgvector` HNSW 向量近似搜索（1024 维密集向量）。
- **关键字路 (Keyword Search - 零成本方案)**：
  - 使用 PostgreSQL 内置的 **`pg_trgm` (N-gram 倒排索引扩展)** 与 `tsvector` 全文检索。
  - **优势**：媲美专业 Elasticsearch (ES) 的 BM25 专有名词与型号精确匹配能力，**无需额外部署/付费 ES 集群，0 额外内存与成本开销**。
- **实现方式**：双路并发召回 Top 20 节点。

#### 1.2 GraphRAG 知识图谱扩展 (基于 Neo4j AuraDB 免费云)
- 引入 **Neo4j AuraDB Free（永久免费云端图数据库，支持 20万节点）**；
- 在文档解析时使用 LLM 提取 `(实体A)-[关系]->(实体B)` 三元组；
- 对涉及多跳关系、人物关联或复杂因果的提问，生成 Cypher 图查询，补全向量与全文检索覆盖不到的关系网。

#### 1.3 RRF 排名融合与 Rerank 重排
- 使用 **RRF (Reciprocal Rank Fusion)** 算法融合“向量路 + `pg_trgm` 关键字路 (+ 图谱路)”多路召回结果。
- 接入 **通义 / BGE Rerank 重排模型**，对候选切片进行二次精细打分，挑选最优质的 Top 4 注入 LLM。

#### 1.4 “小块匹配，大块作答”邻居窗口扩展 (Context Expansion)
- 向量切片保持 300 字提高命中率；
- 命中切片后，自动提取其**前后 ±2 片邻居段落（合并为 1500 字大块）**注入 prompt，彻底解决断章取义问题。

---

### 阶段 2：多级知识组织与空间权限 (Knowledge Hierarchy & ACL) —— 解决“管理乱”

企业级场景需要树形目录层级和部门隔离。

#### 2.1 无限极树形分类目录 (Category Tree)
- 在 `kh_category` 中增加 `parent_id` 字段，支持 **1级 ➔ 2级 ➔ 3级 ➔ N级 树形分类**。
- 前端组件支持 Ant Design **Tree 树状侧边栏** 与文档拖拽归类。

#### 2.2 部门与空间权限隔离 (Workspace ACL)
- 结合 `kh_team` 实施隔离：仅本部门员工或有权限的用户可搜索特定目录下的知识。
- 检索时支持 **Pre-filtering 预过滤**：在 SQL 层先过滤部门权限，再算向量距离，兼顾性能与安全。

---

### 阶段 3：AI 智能问答与黄金选型 (Vercel AI SDK + LangChain Tools) —— 解决“体验差”

从单一的“文档管理”升级为“对话式智能 AI 知识助手”，采用全网最顶级的 **“后端 LangChain Agent + 适配器 ➔ 前端 Vercel AI SDK”** 黄金全栈架构：

#### 3.1 后端：NestJS + LangChain Tools 体系 (Tool Calling)
- **依赖库**：`@langchain/core`, `@langchain/openai`, `ai`
- **工具封装 (`DynamicStructuredTool`)**：
  - `knowledge_retriever`：向量切片检索工具，Agent 根据用户意图自主决策是否触发查库。
- **消息流转换**：使用 Vercel 官方 `LangChainAdapter.toDataStreamResponse` 适配器，将 LangChain Agent 执行流一键转化为 Vercel Data Stream 协议。

#### 3.2 前端：Vercel AI SDK (`useChat` Hook) + 100% 自由自定义 UI
- **依赖库**：`ai`, `@ai-sdk/react`
- **极致体验 Hook**：使用 `useChat` 处理聊天历史、输入框绑定、极速打字机流式更新与自动置底。
- **自由自定义 UI 视觉**：遵循 Headless 设计，搭配 **Ant Design + Tailwind CSS** 打造美观的气泡对话 Drawer、输入框与 Loading 动画。

#### 3.3 可验证引用出处 (Citations with Markdown Badges)
- AI 回答中带有强引用角标（如 `[1] 《NestJS最佳实践.docx》`）。
- 点击角标弹出 Tooltip / 预览高亮源文档段落与相似度打分。

---

### 阶段 4：工程化运维与生产隔离 (DevOps & Production) —— 解决“上线难”

#### 4.1 生产与测试环境完全隔离
- **Supabase**：`dev` 库与 `prod` 库独立项目物理隔离。
- **Render / 部署**：配置独立的生产 Web Service 实例与 `.env.production` 环境变量。

#### 4.2 运维补偿控制台
- 提供可视化界面，查看 RabbitMQ 死信队列（DLX）中的失败任务，支持一键重试或人工补算向量。

---

## 📅 三、 实施优先级建议 (Priority Summary)

1. **最高优先级 (P0)**：**问答 Agent (Vercel AI SDK + LangChain Tools)** ➔ **完成产品的关键闭环与高颜值流式对话体验**。
2. **高优先级 (P1)**：`pg_trgm` 混合检索 (Hybrid Search) + Rerank 重排 ➔ **提升检索准确度（0 额外成本）**。
3. **中优先级 (P2)**：树形目录与多级空间 ➔ **完善企业级管理功能**。
4. **图谱扩展 (P3)**：Neo4j AuraDB 知识图谱扩展 ➔ **支撑多跳关系高级检索**。
