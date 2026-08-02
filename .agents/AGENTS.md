# Workspace Rules / 项目规则

- 项目包管理器统一使用 **pnpm**（而非 npm），包括依赖安装 (`pnpm i`), 脚本运行 (`pnpm run build`), 测试 (`pnpm test`) 等所有终端命令。
- 项目环境变量与密钥统一由 **Infisical** 托管注入（命令前缀 `infisical run --`），不再使用或依赖本地 `.env` 文件。

