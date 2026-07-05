import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableMap, RunnableLambda } from "@langchain/core/runnables";

const addOne = RunnableLambda.from((num: number) => num + 1)
const mulity = RunnableLambda.from((num: number) => num * 2)
const square = RunnableLambda.from((num: number) => num * num)


const gerrtTemplate = PromptTemplate.fromTemplate(`
    你好,{name}!!
    `)
const weatherTemplate = PromptTemplate.fromTemplate(`
    今天的天气{weather}
    `)

const runNableMap = RunnableMap.from({
    add: addOne,
    mulity: mulity,
    square: square,
    gert: gerrtTemplate,
    weather: weatherTemplate
})

async function main() {
    const res = await runNableMap.invoke({
        name: "张三",
        weather: "晴天"
    })
    console.log(res)
}

main()
