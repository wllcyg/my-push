import { RouterRunnable, RunnableLambda } from "@langchain/core/runnables";

const toUpperCase = RunnableLambda.from((input: string) => input.toUpperCase())
const reverText = RunnableLambda.from((input: string) => input.split('').reverse().join(''))

const router = new RouterRunnable({
    runnables: {
        toUpperCase,
        reverText
    },
})


async function runMain() {
    // 测试 1: 走 toUpperCase 分支
    const result1 = await router.invoke({
        key: "toUpperCase",
        input: "hello langchain"
    })
    console.log("转大写结果:", result1)

    // 测试 2: 走 reverText 分支
    const result2 = await router.invoke({
        key: "reverText",
        input: "123456789"
    })
    console.log("反转文本结果:", result2)
}

runMain()