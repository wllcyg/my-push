import { RunnablePassthrough, RunnableLambda, RunnableSequence, RunnableMap } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
    // 第一步：将纯字符串输入（例如 "langchain"）转换为一个带有属性的对象
    RunnableLambda.from((input: string) => ({ concept: input })),

    // 第二步：并行处理分支 (RunnableMap)
    RunnableMap.from({
        // original 分支：使用 RunnablePassthrough 原封不动地透传上一层的输出
        original: new RunnablePassthrough(),

        // processed 分支：提取上一层的数据，进行加工处理
        processed: RunnableLambda.from((obj: { concept: string }) => ({
            concept: obj.concept, // 注意：这里修复了原图中的作用域问题
            upper: obj.concept.toUpperCase(),
            length: obj.concept.length,
        }))
    })
]);


// 如果需要对原属性进行拓展
const expatChain = RunnableSequence.from([
    RunnableLambda.from((input: string) => ({ concept: input })),
    RunnablePassthrough.assign({
        original: new RunnablePassthrough(),
        processed: RunnableLambda.from((obj: { concept: string }) => ({
            concept: obj.concept,
            upper: obj.concept.toUpperCase(),
            length: obj.concept.length
        }))
    })
])


async function runMain() {
    const result = await chain.invoke("langchain");
    const expatChainRes = await expatChain.invoke("langchain");
    console.log("最终结果:");
    console.log(JSON.stringify(result, null, 2));

    console.log("拓展结果:");
    console.log(JSON.stringify(expatChainRes, null, 2));
}

runMain();
