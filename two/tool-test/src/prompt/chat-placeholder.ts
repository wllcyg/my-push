import { model } from "@/model.js";
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'


const chatPromptHistory = ChatPromptTemplate.fromMessages([
    [
        'system',
        `你是一名资深的工程效率顾问,善于在多轮对话的上线文中给出具体可执行建议`
    ],
    new MessagesPlaceholder('history'),
    [
        'human',
        `这是用户本轮的新问题,{ current_input }
        请结合历史的对话给出建议
        `
    ]

])

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { printStream } from '@/utils.js';

const historyMessages = [
    new HumanMessage("你好，我们团队最近在推行 CI/CD，但是目前前端项目的构建耗时需要 20 分钟以上，太慢了，有什么核心优化方向吗？"),
    new AIMessage(`你好！前端项目构建慢一般可以通过以下三个最显著的手段来优化：
1. **依赖缓存**：在 CI 配置中对 node_modules 进行持久化缓存，避免每次都执行全新的 npm/pnpm install。
2. **构建工具打包加速**：如果使用的是 Webpack，可以考虑升级到 Vite、Esbuild 或 Rspack 这类现代化的 Rust 构建工具，构建速度能有数倍到数十倍的提升。
3. **分包与并行**：通过多任务并行跑 Lint、Unit Test 和 Build，避免单流水线串行阻塞。`),
    new HumanMessage("好的，多谢！目前我们的依赖安装确实占了 8 分钟。另外，我们的部署包包体有 100MB，上传静态资源服务器也特别慢。"),
    new AIMessage(`针对 100MB 的大部署包，主要有以下精简和上传优化方向：
1. **资源静态化与 CDN 分离**：图片、字体、大视频等静态资源不要打包进最终的代码包中，应该在构建后直接上传到 OSS/COS，并通过 CDN 访问，前端只引用链接。
2. **代码分割 (Code Splitting)**：使用 React.lazy / Vue defineAsyncComponent 对非首屏路由做动态导入，按需加载，精简 JS 包体。
3. **Tree Shaking**：检查大依赖（如 lodash，chart.js），改用 lodash-es 等支持 Tree Shaking 的库，避免无用代码打包。
4. **开启 Gzip/Brotli 压缩**：在静态服务器配置并自动压缩，大幅减少网络传输体积。`),
    new HumanMessage("明白，我们的大静态资源确实多。除了前端，我们的 Node.js 后端服务 Docker 镜像也有 1.2GB，在 CI 打包和拉取镜像时也是龟速，这块如何瘦身？"),
    new AIMessage(`Node.js 服务 Docker 镜像高达 1.2GB 的常见优化策略如下：
1. **使用多阶段构建 (Multi-stage Builds)**：这是最核心的手段。第一阶段用于编译和安装 devDependencies，第二阶段仅复制生产所需的 node_modules（使用 npm prune --production）和构建好的 dist 代码。
2. **使用更小的基础镜像**：不要直接用 node:latest（约 900MB），改用 node:18-alpine（仅约 170MB）或者 node:18-slim（约 240MB）。
3. **清理缓存与垃圾**：在 RUN 安装完依赖后，顺手清理 npm cache clean --force 并在 .dockerignore 中忽略本地的 .git、node_modules、tests 等无用文件夹。`)
];

async function runMain() {
    try {
        const formattedMessages = await chatPromptHistory.formatMessages({
            history: historyMessages,
            current_input: "如何把以上所有的优化措施，比如多阶段构建、依赖缓存、Vite 打包等整合进 GitLab CI 配置文件中？"
        });

        console.log("=== 格式化后的 MessagesPlaceholder 对话链 ===");
        console.log(formattedMessages);

        console.log("\n=== 正在流式调用大模型生成整合建议 ===\n");
        const stream = await model.stream(formattedMessages);
        await printStream(stream);

    } catch (error) {
        console.error("执行出错:", error);
    }
}

runMain();