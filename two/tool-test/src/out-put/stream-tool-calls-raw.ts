import { model } from "@/model.js";
import { athleteSchema } from "@/schemas/athlete.js";

async function runMain() {
  const modelWidthTools = model.bindTools([{
    name: "get_user_info",
    description: "提取和结构化所问用户的详细信息",
    schema: athleteSchema
  }])

  const prompt = `介绍一下 Faker`

  try {
    const stream = await modelWidthTools.stream(prompt)

    let chunkIndex = 0
    for await (const chunk of stream) {
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        process.stdout.write(chunk.tool_call_chunks[0].args || '');
      }
    }

  } catch (e) {
    console.error(e)
  }

}

runMain()