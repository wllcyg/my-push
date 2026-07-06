import { model } from "@/model.js";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import chalk from "chalk";
import { RunnableSequence, RunnableLambda, RunnableBranch, RunnablePassthrough } from '@langchain/core/runnables'
import { tools } from "@langchain/openai";


const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "amap-maps-streamableHTTP": {
      "url": `https://mcp.amap.com/mcp?key=${process.env.GAODE_MCP_KEY}`
    }
  }
})


async function runMain(query: string, maxInterations = 30) {
  const tools = await mcpClient.getTools()
  const modelWidthTools = model.bindTools(tools)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个可以调用mcp工具的助手，请根据用户的问题调用工具来解决用户的问题"],
    new MessagesPlaceholder("messages"),
  ])

  const llmChain = prompt.pipe(modelWidthTools)

  // 定义工会调用逻辑

  const toolExecutor = new RunnableLambda({
    func: async (input: any) => {
      const { response, tools } = input
      const toolResults = []

      for (const toolCall of response.tool_calls ?? []) {

        const findTool = tools.find((t: { name: any; }) => t.name === toolCall.name)
        if (!findTool) {
          continue;
        }

        const toolResult = await findTool.invoke(toolCall.args)
        const contenStr = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult, null, 2)

        toolResults.push(new ToolMessage({
          content: contenStr,
          tool_call_id: toolCall.id
        }))
      }

      return toolResults;

    }
  })

  //  对结果进行处理

  const agentStrpChain = RunnableSequence.from([
    RunnablePassthrough.assign({
      response: llmChain
    }),
    RunnableBranch.from([
      [
        // 已经没有tools了
        state => !state.response.tool_calls || state.response.tool_calls.length === 0,
        new RunnableLambda({
          func: async (state: any) => {

            const { messages, response } = state
            const newMessages = [...messages, response]
            return {
              ...state,
              messages: newMessages,
              done: true,
              final: response.content
            }
          }
        })
      ],
      // 默认分支
      RunnableSequence.from([
        new RunnableLambda({
          func: async (state: { messages: any; response: any; }) => {
            const { messages, response } = state
            const newMessage = [...messages, response]
            return {
              ...state,
              messages: newMessage,

            }
          }
        }),
        RunnablePassthrough.assign({
          toolMessages: toolExecutor
        }),
        new RunnableLambda({
          func: async (state: { messages: any; toolMessages: any; }) => {
            const { messages, toolMessages } = state
            const newMessages = [...messages, ...(toolMessages ?? [])]
            return {
              ...state,
              messages: newMessages,
              done: false,
            }
          }
        })
      ]),
    ])
  ])

  // 执行
  let state = {
    messages: [new HumanMessage(query)],
    done: false,
    final: null,
    tools
  }

  for (let i = 0; i < maxInterations; i++) {
    console.log(chalk.bgGreen('正在调用第' + i + '次'));
    state = await agentStrpChain.invoke(state)
    if (state.done) {
      console.log(`\n✨ AI 最终回复:\n${state.final}\n`);
      return state.final;
    }


  }
}



runMain('长宁区大融城附近的酒店');
