# Enterprise Knowledge Base (企业知识库后端服务)

基于 **NestJS** 构建的企业级知识库系统后端服务，集成向量数据库 (PostgreSQL + pgvector) 与文档数据库 (MongoDB)，支持多模态文档解析、向量检索与 RAG 知识问答。

---

## 🛠️ 技术栈

- **核心框架**: [NestJS](https://nestjs.com/) (TypeScript / Node.js)
- **包管理器**: [pnpm](https://pnpm.io/)
- **关系与向量数据库**: PostgreSQL (带 `pgvector` 扩展，支持 Supabase / Docker 自建)
- **文档数据库**: MongoDB (支持 MongoDB Atlas / Docker 自建)
- **代码规范**: ESLint + Prettier

---

## ⚙️ 环境要求

- **Node.js**: >= 18.x
- **pnpm**: >= 8.x
- **数据库需求**:
  - PostgreSQL 16+ (带 `pgvector` 扩展)
  - MongoDB 7.0+

---

## 🚀 快速开始

### 1. 安装依赖

```bash
$ pnpm install
```

### 2. 数据库配置

确保本地 Docker 或云数据库已启动（详见后端 Docker 配置或 Supabase / MongoDB Atlas 接入指南）：

- **PostgreSQL**: `localhost:5432` (数据库: `knowledge_hub`)
- **MongoDB**: `localhost:27017` (数据库: `knowledge_hub`)

### 3. 运行服务

```bash
# 开发模式（热重载）
$ pnpm run start:dev

# 调试模式
$ pnpm run start:debug

# 生产构建与运行
$ pnpm run build
$ pnpm run start:prod
```

---

## 🧪 单元测试 & 端到端测试

```bash
# 单元测试
$ pnpm run test

# 端到端 (E2E) 测试
$ pnpm run test:e2e

# 测试覆盖率报告
$ pnpm run test:cov
```

---

## 📁 目录结构

```text
enterprise-knowledge-base/
├── src/
│   ├── app.controller.ts    # 根控制器
│   ├── app.module.ts        # 根模块
│   ├── app.service.ts       # 根服务
│   └── main.ts              # 应用入口
├── test/                    # 测试文件
├── nest-cli.json            # Nest CLI 配置
├── tsconfig.json            # TypeScript 配置
└── package.json             # 项目依赖与脚本
```

---

## 📝 开源协议

[MIT licensed](LICENSE)

