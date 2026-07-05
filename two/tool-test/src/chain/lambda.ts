import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

//对普通函数二次封装

const add = RunnableLambda.from((input: number) => {
    console.log('输入了', input);

    return input + 1
})


const multiply = RunnableLambda.from((input: number) => input * 2)

async function main() {


    const chain = RunnableSequence.from([
        add,
        multiply
    ])
    const res = await chain.invoke(2)
    console.log('结果', res);

}

main()