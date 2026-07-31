# ----------------------------------------------------
# Stage 1: Build Phase (打包构建)
# ----------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# 激活 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖清单并安装
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源码并编译产物
COPY . .
RUN pnpm run build

# ----------------------------------------------------
# Stage 2: Production Runner Phase (生产运行)
# ----------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# 激活 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production

# 只安装生产依赖，大幅减小镜像体积
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 复制编译产物
COPY --from=builder /app/dist ./dist

# 暴露暴露运行端口
EXPOSE 3000

# 启动服务
CMD ["node", "dist/main.js"]
