import 'cheerio'
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { model, embeddingModel } from '@/model.js'
import { formatDocumentsAsString } from './utils.js'




const cheerioLoader = new CheerioWebBaseLoader('https://juejin.cn/post/7585839411122454574', {
    selector: 'p'
})

async function runSplit(content: string) {

    const documents = await cheerioLoader.load()

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
        separators: ["。", "！", "？", '\n\n', '\n', ' ', '']
    })
    const splitDocuments = await textSplitter.splitDocuments(documents)

    const vectorStore = await MemoryVectorStore.fromDocuments(
        splitDocuments,
        embeddingModel
    )

    const retriever = vectorStore.asRetriever({ k: 3 })

    const retirevedDocs = await retriever.invoke(content)

    const context = formatDocumentsAsString(retirevedDocs)
    console.log("组装好的 Context 如下：\n", context)

    const prompt = `你是一个文章辅助阅读助手,根据文章来回答:
    
    文章内容: ${context}

    问题:${content}

    你的回答:

    `
    const response = await model.invoke(prompt)

    console.log(response);

}

runSplit('解释一下外包')