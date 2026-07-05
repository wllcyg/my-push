import { RunnableLambda, RunnableEach, RunnableSequence } from "@langchain/core/runnables";


const toUpperCase = RunnableLambda.from((input: string) => input.toUpperCase())
const reverText = RunnableLambda.from((input: string) => input.split('').reverse().join(''))

const processItem = RunnableSequence.from([
    reverText,
    toUpperCase
])
const chain = new RunnableEach({
    bound: processItem
})


async function runMain() {
    const result = await chain.invoke(["hello", "world"])
    console.log('输出结果', result)

}

runMain()
