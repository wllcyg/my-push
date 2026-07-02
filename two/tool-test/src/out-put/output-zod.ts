import { model } from '@/model.js'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { athleteSchema } from '@/schemas/athlete.js'

export { athleteSchema }

const athleteParser = StructuredOutputParser.fromZodSchema(athleteSchema)

async function runMain() {
    const question = `请介绍一下英雄联盟职业选手 Faker（李相赫）的详细信息，包括他的游戏位置、所在战队、职业生涯、主要成就、获得的奖项等。
    ${athleteParser.getFormatInstructions()}
    `;

    const result = await model.invoke(question)

    try {
        const parsedResult = await athleteParser.parse(result.content as string)
        console.log(parsedResult);
    } catch (error) {
        console.error("解析出错:", error);
    }
}

runMain()
