import { model } from "@/model.js";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";


const schema = z.object({
    translation: z.string().describe('这是翻译后的英文文本'),
    keywords: z.array(z.string()).length(3).describe('这是提取的3 个关键词')
})

const outputParse = StructuredOutputParser.fromZodSchema(schema)

const promptTemplate = PromptTemplate.fromTemplate(`
    将一下文本翻译为英文,然后总结为 3 个关键词. \n\n 文本:{text} \n\n {format_instructions}
    `)

const chain = RunnableSequence.from([
    promptTemplate,
    model,
    outputParse
])


async function runMain() {
    const input = {
        text: 'c#是一个很强大的语言,可以在多处场景使用',
        format_instructions: outputParse.getFormatInstructions()
    }


    const response = await chain.invoke(input)

    console.log('输出结果', response)
}

runMain()