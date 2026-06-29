import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { model } from "@/model.js";
import { runAgentLoop } from "@/agentRunner.js"
import "dotenv/config"
import { HumanMessage } from "@langchain/core/messages";
import chalk from "chalk";

const { GAODE_MCP_KEY } = process.env


const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        "amap-maps-streamableHTTP": {
            "url": `https://mcp.amap.com/mcp?key=${GAODE_MCP_KEY}`
        }
    }
})

async function runTools(content: string) {
    const tools = await mcpClient.getTools()
    const modelWithTools = model.bindTools(tools)
    const response = await runAgentLoop(modelWithTools, tools, [new HumanMessage({ content })])
    console.log(chalk.green("✅ [Agent] 任务完成！\n"));
    console.log(response.content);
}
runTools('你好，查一下上海明珠家园 3 区附近的酒店') 