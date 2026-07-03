import { model } from '@/model.js'
import { athleteSchema } from '@/schemas/athlete.js'


async function runMain() {

    const structuredModel = model.withStructuredOutput(athleteSchema)

    const result = await structuredModel.invoke("介绍一下 神超")

    console.log(result)
}

runMain()