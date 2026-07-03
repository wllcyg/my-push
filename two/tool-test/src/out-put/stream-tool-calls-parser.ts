import { model } from "@/model.js";
import { athleteSchema } from "@/schemas/athlete.js";
import { JsonOutputToolsParser } from '@langchain/core/output_parsers/openai_tools';

async function runMain() {

  const modelWidthTools = model.bindTools([
    { name: "get_user_info", schema: athleteSchema, description: "介绍一下 提问到的人并格式化" }
  ])
  const parser = new JsonOutputToolsParser()
  const chain = modelWidthTools.pipe(parser);



  const prompt = `介绍一下 faker`

  try {

    const stream = await chain.stream(prompt)

    let fullContent = ''
    let chunkCount = 0
    let lastContent = ''

    for await (const chunk of stream) {
      const toolCalls = chunk as any[];
      chunkCount++;
      // console.log(chunk);

      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0];

        // 获取当前工具调用的完整参数内容
        const currentContent = JSON.stringify(toolCall.args || {}, null, 2);

        if (currentContent.length > lastContent.length) {
          const newText = currentContent.slice(lastContent.length);
          process.stdout.write(newText); // 实时输出到控制台
          lastContent = currentContent; // 更新已读进度
        }

        // console.log(toolCall.args);
      }
    }
    console.log(`完整的数据块${chunkCount}个`);
  } catch (e) {
    console.error(e)
  }

}

runMain()