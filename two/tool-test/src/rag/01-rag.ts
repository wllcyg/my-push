import { Document } from "@langchain/core/documents";
import { model, embeddingModel } from "@/model.js";
import mcokData from './mock_rag_data.json' with { type: "json" };
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { formatDocumentsAsString } from "./utils.js";

const documents = mcokData.map(item => {
    return new Document(item)
})

async function runRag() {
    const vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        embeddingModel
    )
    const retriever = vectorStore.asRetriever({ k: 3 })

    const question = '每年带薪休假天数有多少'

    // 获取文档

    const retirevedDocs = await retriever.invoke(question)



    console.log(retirevedDocs, '这是一个文档');

    const context = formatDocumentsAsString(retirevedDocs)

    const prompt = `你是一个专业的企业人事助理。请根据以下提供的背景知识来回答用户的问题。如果背景知识中没有提及相关内容，请直接回答“基于当前知识库我不知道”，千万不要编造答案。

背景知识：
${context}

用户问题：
${question}`

    const response = await model.invoke(prompt)
    console.log("================================")
    console.log("大模型回答:\n", response.content)

}

runRag()