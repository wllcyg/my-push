import { Document } from "@langchain/core/documents";

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
