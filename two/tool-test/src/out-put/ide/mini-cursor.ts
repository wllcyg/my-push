import { model } from "@/model.js";
import chalk from "chalk";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { execCommandTool, listDirTool, readFileTool, writeFileTool } from '@/tools/tools.js';
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

const tools = [readFileTool, writeFileTool, execCommandTool, listDirTool];
const modelWidthTools = model.bindTools(tools);

async function runMain(query: string, maxIterations = 30) {
    const history = new InMemoryChatMessageHistory();

    await history.addMessage(
        new SystemMessage(
            `你是一个项目管理助手，使用工具完成任务。

当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. exec_command: 执行命令（支持 workingDirectory 参数）
4. list_dir: 列出目录

重要规则 - exec_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }

重要规则 - write_file：
- 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入`
        )
    );

    await history.addMessage(new HumanMessage(query));

    // ==================== Agent 循环 ====================
    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk.bgGreen(`\n⏳ 正在等待 AI 思考...`));

        // 1. 获取当前所有消息历史，发送给模型进行流式推理
        const messages = await history.getMessages();
        const rawStream = await modelWidthTools.stream(messages);

        // 2. 准备一个空容器来拼接完整的 AIMessage
        let fullAiMessage: any = null;

        // 3. 准备工具调用的 JSON 增量解析器（专门解析 tool_calls）
        const toolParser = new JsonOutputToolsParser();

        // 4. 记录每个工具调用已打印的长度（用于 write_file 的流式增量预览）
        const printedLengths = new Map<string, number>();

        console.log(chalk.bgBlue(`\n🚀 Agent 开始思考并生成流...\n`));

        // ==================== 流式读取循环 ====================
        for await (const chunk of rawStream) {
            // 5. 逐 chunk 拼接，最终得到完整的 AI 回复
            fullAiMessage = fullAiMessage ? fullAiMessage.concat(chunk) : chunk;

            // 6. 尝试从当前已拼接的消息中解析出工具调用
            let parsedTools: any[] | null = null;
            try {
                parsedTools = await toolParser.parseResult([{ message: fullAiMessage }] as any) as any[];
            } catch (e) {
                // 解析失败说明 JSON 还不完整，忽略继续累积
            }

            // 7. 如果解析出了工具调用，做流式预览
            if (parsedTools && parsedTools.length > 0) {
                for (const toolCall of parsedTools) {
                    // 只对 write_file 做流式预览（内容通常很长，适合边生成边展示）
                    if (toolCall.type === 'write_file' && toolCall.args?.content) {
                        const toolCallId = toolCall.id || toolCall.args.filePath || 'default';
                        const currentContent = String(toolCall.args.content);
                        const previousLength = printedLengths.get(toolCallId);

                        if (previousLength === undefined) {
                            printedLengths.set(toolCallId, 0);
                            console.log(
                                chalk.bgBlue(`\n[工具调用] write_file("${toolCall.args.filePath}") - 开始写入（流式预览）\n`)
                            );
                        }

                        // 只打印新增部分（增量输出）
                        if (currentContent.length > (printedLengths.get(toolCallId) ?? 0)) {
                            const newContent = currentContent.slice(printedLengths.get(toolCallId) ?? 0);
                            process.stdout.write(newContent);
                            printedLengths.set(toolCallId, currentContent.length);
                        }
                    }
                }
            } else {
                // 8. 没有工具调用时，直接输出 AI 的文本回复
                if (chunk.content) {
                    process.stdout.write(
                        typeof chunk.content === 'string'
                            ? chunk.content
                            : JSON.stringify(chunk.content)
                    );
                }
            }
        }

        // ==================== 流结束后处理 ====================

        // 9. 完整的 AI 回复存入消息历史
        await history.addMessage(fullAiMessage);
        console.log(chalk.green('\n✅ 消息已完整存入历史'));

        // 10. 检查是否有工具调用，没有则说明 AI 认为任务完成
        if (!fullAiMessage.tool_calls || fullAiMessage.tool_calls.length === 0) {
            console.log(`\n✨ AI 最终回复:\n${fullAiMessage.content}\n`);
            return fullAiMessage.content;
        }

        // 11. 逐个执行工具调用
        for (const toolCall of fullAiMessage.tool_calls) {
            const foundTool = tools.find(t => t.name === toolCall.name);
            if (foundTool) {
                console.log(chalk.yellow(`\n🔧 执行工具: ${toolCall.name}`));
                const toolResult = await (foundTool as any).invoke(toolCall.args);

                // 12. 将工具结果作为 ToolMessage 存入历史，tool_call_id 必须对应
                await history.addMessage(
                    new ToolMessage({
                        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                        tool_call_id: toolCall.id,
                    })
                );
            }
        }
        // 13. 回到循环顶部，AI 看到工具结果后继续思考
    }

    const finalMessages = await history.getMessages();
    return finalMessages[finalMessages.length - 1].content;
}

// ==================== 测试用例 ====================
const testQuery = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目: echo -e "n\\nn" | pnpm create vite react-todo-app --template react-ts
2. 修改 src/App.tsx，实现完整功能的 TodoList：
   - 添加、删除、编辑、标记完成
   - 分类筛选（全部/进行中/已完成）
   - 统计信息显示
   - localStorage 数据持久化
3. 添加复杂样式：
   - 渐变背景（蓝到紫）
   - 卡片阴影、圆角
   - 悬停效果
4. 添加动画：
   - 添加/删除时的过渡动画
   - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果

去掉 main.tsx 里的 index.css 导入

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`;

try {
    await runMain(testQuery);
} catch (error: any) {
    console.error(`\n❌ 错误: ${error.message}\n`);
}
