import { RunnableBranch, RunnableLambda } from "@langchain/core/runnables";
// 条件判断分支
// 条件判断

const isPositive = RunnableLambda.from((input: number) => input > 0)
const isNegative = RunnableLambda.from((input: number) => input < 0)
const isEven = RunnableLambda.from((input: number) => input % 2 === 0)

// 创建分支函数

const handlePositive = RunnableLambda.from((input: number) => {
    console.log('处理正数:', input)
    return input * 2
})
const handleNegative = RunnableLambda.from((input: number) => {
    console.log('处理负数:', input)
    return input * 2
})
const handleEven = RunnableLambda.from((input: number) => {
    console.log('处理偶数:', input)
    return input * 2
})
const handleOdd = RunnableLambda.from((input: number) => {
    console.log('处理奇数:', input)
    return input * 2
})

const branch = RunnableBranch.from([
    [isPositive, handlePositive],
    [isNegative, handleNegative],
    [isEven, handleEven],
    handleOdd // 最后一个必须是兜底（默认）分支，不带条件
])


async function runMain() {
    const result = await branch.invoke(5)
    console.log('输出结果', result)
}

runMain()