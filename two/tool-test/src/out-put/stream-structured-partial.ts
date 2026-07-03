import { z } from 'zod'
import { model } from "@/model.js";
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { athleteSchema } from '@/schemas/athlete.js'


async function runMain() {
  const parser = StructuredOutputParser.fromZodSchema(athleteSchema);

  const prompt = `介绍一下 faker , 
  格式化要求:${parser.getFormatInstructions()}
  `

  try {

    const stream = await model.stream(prompt)

    let fullContent = ''
    let chunkCount = 0

    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content
        chunkCount++;
        process.stdout.write(chunk.content as string || "")
      }
    }
    console.log(`完整的数据块${chunkCount}个`);
    const res = await parser.parse(fullContent)
    console.log(res)
  } catch (e) {
    console.error(e)
  }

}

runMain()