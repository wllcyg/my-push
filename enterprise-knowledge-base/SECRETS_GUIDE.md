# 🔐 团队环境变量与密钥管理指南 (Infisical)

为了解决远程团队协作中本地 `.env` 文件易泄露、参数同步繁琐以及生产配置管理不安全的问题，本项目采用 **[Infisical](https://infisical.com/)** 作为统一的分布式密钥管理平台。

项目源码中**不包含任何明文密码与敏感 API Key**，所有本地开发与云端部署的环境变量均由 Infisical 统一进行动态内存注入。

---

## 🚀 新开发者快速上手

作为新加入项目的开发者，只需以下 4 步即可快速启动项目：

### 1. 获得 Infisical 项目访问权限
请联系团队管理员，将您的注册邮箱邀请加入 **Infisical** 上的 `enterprise-knowledge-base` 项目。

### 2. 本地安装 Infisical CLI 工具
在本地电脑终端（PowerShell 或 CMD）中全局安装 CLI：

```bash
# npm 安装（推荐）
npm install -g @infisical/cli

# 或使用 Windows winget 安装
winget install Infisical.InfisicalCLI
```

### 3. 登录与初始化关联
在项目根目录下运行登录并关联项目：

```bash
# 1. 登录账号（会弹出浏览器授权，点击 Grant Access 允许）
infisical login

# 2. 关联项目
infisical init
```
*在弹出的交互菜单中：*
- **Organization**: 选择 `Personal Org`（或团队组织）
- **Project**: 选择 `enterprise-knowledge-base`
- **Default Environment**: 选择 `dev`

初始化完成后，会在根目录下自动生成 `.infisical.json` 关联文件。

### 4. 一键启动本地开发服务
无需手动创建或填写 `.env` 文件，直接运行正常的启动脚本即可：

```bash
pnpm start:dev
```
> `package.json` 中的 `start:dev` 脚本已配置为 `infisical run -- nest start --watch`，会自动在内存中在线加载最新开发环境变量。

---

## 🛠️ 常见操作指南

### 1. 如何新增或修改环境变量？
- 请访问 [Infisical 控制台](https://app.infisical.com/)。
- 进入 `enterprise-knowledge-base` 项目 -> 选择对应环境（如 `Development`）。
- 直接在网页界面新增/修改键值对保存。
- **无需通知团队成员重发文件**，大家下次运行 `pnpm start:dev` 时即可自动生效。

### 2. 更新 `.env.example`
当您在 Infisical 中新增了环境变量字段时，请同步在根目录的 `.env.example` 中补充脱敏的字段名与注释，并提交到 Git 仓库，保持代码库模版最新。

---

## ☁️ 云端生产部署 (Production)

在云服务器、Docker 容器或 CI/CD 构建流水线中，通过以下方式访问生产密钥：

1. 在 Infisical 面板的 `Machine Identities` / `Service Tokens` 中生成一个只读的生产 Token。
2. 在服务器节点仅配置一个环境变量：`INFISICAL_TOKEN=<your-service-token>`。
3. 容器或启动命令配置为：
   ```bash
   infisical run --env=prod -- pnpm start:prod
   ```

---

## ⚠️ 安全规则

- 绝对**不要**将包含真实密匙的 `.env` 文件提交至 Git 仓库。
- 根目录下的 `.gitignore` 已配置过滤 `.env*` 规则，请保持规则生效。
