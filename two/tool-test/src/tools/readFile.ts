import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs';
import { SystemMessage, HumanMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';

import { createModel } from '@/model.js'

const model = createModel(
    {
        temperature: 0
    }
)


export const readFileTool = tool(
    // 注意：这里必须是解构对象 { filePath }
    async ({ filePath }: { filePath: string }) => {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return `File content:\n${content}`;
        } catch (error) {
            return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
    {
        name: 'read_file',
        description: `
            用这个工具来读取文件,查看代码
            当用户要求你读取文件内容的时候,就用这个工具,
            路径可以是绝对或者相对路径
        `,
        schema: z.object({
            filePath: z.string().describe('要读取的文件的路径'),
        }),
    }
);

const tools = [readFileTool];
// 注意：bindTools 返回一个新的已绑定工具的模型实例
const modelWithTools = model.bindTools(tools);

const messages: BaseMessage[] = [
    new SystemMessage(`你是一个代码助手,可以读取文件并解释代码。

工作流程:
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释

可用工具:
- read_file: 读取文件内容 (使用此工具来获取文件内容)`),
    new HumanMessage(`
  请读取src/model.ts 文件内容并解释 
`)
];

async function runTool() {
    // 添加用户的测试问题
    let response = await modelWithTools.invoke(messages);

    messages.push(response);

    while (response.tool_calls && response.tool_calls.length > 0) {

        console.log('一共有%d 个调用工具', response.tool_calls.length);

        const toolMessages = await Promise.all(
            response.tool_calls.map(async (toolCall) => {
                const tool = tools.find((t) => t.name === toolCall.name);

                if (!tool) {
                    return new ToolMessage({
                        content: `Error: No tool found with name ${toolCall.name}`,
                        tool_call_id: toolCall.id!,
                        name: toolCall.name
                    });
                }

                try {
                    // 修复点：传入完整的 toolCall，LangChain 会自动将其包装为 ToolMessage 返回
                    return await tool.invoke(toolCall);
                } catch (error) {
                    return new ToolMessage({
                        content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
                        tool_call_id: toolCall.id!,
                        name: toolCall.name
                    });
                }

            })
        );

        messages.push(...toolMessages);

        console.log("工具执行完毕，模型正在基于工具内容进行思考...");
        response = await modelWithTools.invoke(messages);
        messages.push(response);
    }

    console.log("\n====== 最终回答 ======\n");
    console.log(response.content);
}

// 只有当直接运行本文件时才执行测试（防止被其他文件 import 时也跑一遍测试）
if (import.meta.url === `file://${process.argv[1]}`) {
    runTool().catch(console.error);
}