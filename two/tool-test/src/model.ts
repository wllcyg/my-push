import "dotenv/config";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

// 封装一个默认的模型实例，以后到处直接引入即可
export const model = new ChatOpenAI({
  model: process.env.OPEN_AI_MODEL_NAME,
  apiKey: process.env.ALIYUN_API_KEY,
  configuration: {
    baseURL: process.env.OPEN_AI_BASEUEL,
  },
});

// 如果以后需要创建不同参数的模型（比如调整 temperature），也可以导出一个工厂函数
export const createModel = (options?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>) => {
  return new ChatOpenAI({
    model: process.env.OPEN_AI_MODEL_NAME,
    apiKey: process.env.ALIYUN_API_KEY,
    configuration: {
      baseURL: process.env.OPEN_AI_BASEUEL,
    },
    ...options
  });
};


// 向量化的模型
export const embeddingModel = new OpenAIEmbeddings({
  model: process.env.OPEN_AI_EMBEDDING_NAME,
  apiKey: process.env.ALIYUN_API_KEY,
  configuration: {
    baseURL: process.env.OPEN_AI_BASEUEL,
  },
});