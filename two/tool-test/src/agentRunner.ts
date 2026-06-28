import { BaseMessage, ToolMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { StructuredTool } from "@langchain/core/tools";
import chalk from "chalk";

/**
 * 封装的 Agent 运行循环
 * @param modelWithTools 已经绑定好工具的 LLM 实例
 * @param tools 工具列表
 * @param messages 当前的历史对话消息数组
 * @returns 最终大模型的回复 (AIMessage)
 */
export async function runAgentLoop(
    modelWithTools: Runnable<any, any>,
    tools: StructuredTool[],
    messages: BaseMessage[]
) {
    console.log(chalk.cyan("🤖 [Agent] 思考中..."));
    let response = await modelWithTools.invoke(messages);
    messages.push(response);

    while (response.tool_calls && response.tool_calls.length > 0) {
        console.log(chalk.yellow(`\n🔧 [Agent] 决定调用 ${response.tool_calls.length} 个工具: `) + chalk.magenta(response.tool_calls.map((t: any) => t.name).join(', ')));

        const toolMessages = await Promise.all(
            response.tool_calls.map(async (toolCall: any) => {
                const tool = tools.find((t) => t.name === toolCall.name);

                if (!tool) {
                    return new ToolMessage({
                        content: `Error: No tool found with name ${toolCall.name}`,
                        tool_call_id: toolCall.id!,
                        name: toolCall.name
                    });
                }

                try {
                    console.log(chalk.gray(`   -> 执行工具 [${tool.name}]...`));
                    return await tool.invoke(toolCall);
                } catch (error) {
                    console.log(chalk.red(`   -> 工具 [${tool.name}] 执行出错!`));
                    return new ToolMessage({
                        content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
                        tool_call_id: toolCall.id!,
                        name: toolCall.name
                    });
                }
            })
        );

        messages.push(...toolMessages);

        console.log(chalk.cyan("\n🤖 [Agent] 工具执行完毕，正在基于结果继续思考..."));
        response = await modelWithTools.invoke(messages);
        messages.push(response);
    }

    console.log(chalk.green("\n✅ [Agent] 任务完成！\n"));
    return response;
}
