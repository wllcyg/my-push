import { Document } from "@langchain/core/documents";

import { createEmbeddingModel } from '@/model.js'
import { VECTOR_DIM } from '@/config.js'
/**
 * 将检索到的多个文档片段组装成带有标记的纯文本 Context
 * @param documents 检索出来的文档数组
 * @returns 组装好的纯文本字符串
 */
export function formatDocumentsAsString(documents: Document[]): string {
    return documents
        .map((doc, i) => `[片段${i + 1}]\n${doc.pageContent}`)
        .join("\n\n——\n\n");
}


const embeddingModel = createEmbeddingModel({
    dimensions: VECTOR_DIM,
})

export async function getVector(text: string) {
    const vector = await embeddingModel.embedQuery(text)
    return vector
}

/**
 * 实时在控制台打印大模型的流式输出内容
 * @param stream LangChain 模型的流式响应对象
 */
export async function printStream(stream: AsyncIterable<any>) {
    for await (const chunk of stream) {
        if (chunk.content) {
            process.stdout.write(chunk.content as string);
        }
    }
    console.log("\n");
}
