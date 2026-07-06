import { BOOK_COLLECTION_NAME, VECTOR_DIM } from "@/config.js";
import { model, createEmbeddingModel, createMilvusClient } from "@/model.js";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { MetricType } from "@zilliz/milvus2-sdk-node";

// 向量化的模型
const embeddings = createEmbeddingModel({
  dimensions: VECTOR_DIM
})

// milvus 客户端
const milvusClient = createMilvusClient()

// 初始换数据库

async function initMilvus() {
  await milvusClient.connectPromise;
  try {
    await milvusClient.loadCollection({
      collection_name: BOOK_COLLECTION_NAME,
    })
    console.log('加载 collection 成功');

  } catch (error) {

  }
}


async function runMain() {

  await initMilvus();

  const milvusSearch = new RunnableLambda({
    func: async (input: { question: any; k?: 5 | undefined; }) => {
      const { question, k = 5 } = input

      try {
        const queryVector = await embeddings.embedQuery(question)
        const searchResult = await milvusClient.search({
          collection_name: BOOK_COLLECTION_NAME,
          vector: queryVector,
          limit: k,
          metric_type: MetricType.COSINE,
          output_fields: ["id", "book_id", "chapter_num", "index", "content"],
        })

        const results = searchResult.results ?? [];
        console.log(results, `这是获取到的数据!`);
        const retrievedContent = results.map((item, index) => {
          return {
            id: item.id,
            book_id: item.book_id,
            chapter_num: item.chapter_num,
            index: item.index ?? index,
            content: item.content,
            score: item.score,
          }
        })

        return { question, retrievedContent }

      } catch (error) {
        console.log('检索内容出错');

      }
    }
  })

  const promptTemplate = PromptTemplate.fromTemplate(`
    你是一个专业的小说助手,熟读长安的荔枝,基于小说内容回答问题,用准确详细的语言

    请根据以下《长安的荔枝》小说片段内容回答问题：
    {context}

    用户问题: {question}

    回答要求：
    1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
    2. 可以综合多个片段的内容，提供完整的答案
    3. 如果片段中没有相关信息，请如实告知用户
    4. 回答要准确，符合小说的情节和人物设定
    5. 可以引用原文内容来支持你的回答

    AI 助手的回答:
    `)
  // 构建小说提示词
  const buildPromptInput = new RunnableLambda({
    func: async (input: any) => {
      const { question, retrievedContent } = input
      if (!retrievedContent.length) {
        return {
          hasContext: false,
          question,
          context: "",
          retrievedContent,
        };
      }

      const context = retrievedContent
        .map((item: { chapter_num: any; content: any; }, i: number) => {
          return `[片段 ${i + 1}]
              章节: 第 ${item.chapter_num} 章
              内容: ${item.content}`;
        })
        .join("\n\n━━━━━\n\n");

      return {
        hasContext: true,
        question,
        context,
        retrievedContent,
      }


    }
  })

  const chain = RunnableSequence.from([
    milvusSearch,
    buildPromptInput,
    new RunnableLambda({
      func: async (input: { hasContext: any; question: any; context: any; }) => {
        const { hasContext, question, context } = input;
        if (!hasContext) {
          const fallback =
            "抱歉，我没有找到相关的小说内容。请尝试换一个问题。";
          return { question, context: "", answer: fallback, noContext: true };
        }

        return { question, context, noContext: false };
      }
    }),
    promptTemplate,
    model,
    new StringOutputParser(),
  ])

  const input = `李善德接到的荔枝使任务具体要求是什么？`

  const stream = await chain.stream({
    question: input,
    k: 5,
  });
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }

}
runMain();


