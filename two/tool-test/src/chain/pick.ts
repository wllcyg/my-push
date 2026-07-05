import { RunnableSequence, RunnablePick, RunnableLambda } from "@langchain/core/runnables";

const inputData = {
    name: '张三',
    age: 12,
    email: '123@qq.com'
}

const chain = RunnableSequence.from([
    input => ({ ...input, fullInfo: `${input.name},${input.age}岁了,邮箱是${input.email}` }),
    new RunnablePick(['age', 'fullInfo'])
])

async function runMain() {
    const result = await chain.invoke(inputData)
    console.log('输出结果', result)
}

runMain()

// 进阶用法 1：提取单个字段时，直接返回该字段的值，而不是返回一个对象
const expatChain = RunnableSequence.from([
    input => ({ ...input, fullInfo: `${input.name},${input.age}岁了,邮箱是${input.email}` }),
    new RunnablePick('fullInfo') // 注意这里传的是字符串，而不是数组
])

// 进阶用法 2：语法糖写法，无需 new RunnablePick，直接在链条末尾调用 .pick()
const expatChainSugar = RunnableLambda.from(
    (input: any) => ({ ...input, fullInfo: `${input.name},${input.age}岁了,邮箱是${input.email}` })
).pick('age')

async function runMain2() {
    const result = await expatChain.invoke(inputData)
    console.log('进阶用法', result)
}

runMain2()