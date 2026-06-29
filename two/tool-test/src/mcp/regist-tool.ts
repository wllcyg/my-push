import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { model } from '@/model.js'
import { runAgentLoop } from "@/agentRunner.js"
import { HumanMessage } from "@langchain/core/messages";
import chalk from "chalk";

const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        'my-local-server': {
            command: 'npx',
            args: [
                'tsx',
                '/Users/moliang/Desktop/coder/two/tool-test/src/mcp/my-mcp-serve.ts'
            ]

        }
    }
})

async function runTools(content: string) {
    const tools = await mcpClient.getTools()
    const modelWithTools = model.bindTools(tools)
    const response = await runAgentLoop(modelWithTools, tools, [new HumanMessage({ content })])
    console.log(chalk.green("✅ [Agent] 任务完成！\n"));
    console.log(response);
}
runTools('你好，查一下用户 1的信息') 