import "dotenv/config";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

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

// 支持额外传参（如 dimensions）的向量模型工厂函数
export const createEmbeddingModel = (options?: Partial<ConstructorParameters<typeof OpenAIEmbeddings>[0]>) => {
  return new OpenAIEmbeddings({
    model: process.env.OPEN_AI_EMBEDDING_NAME,
    apiKey: process.env.ALIYUN_API_KEY,
    configuration: {
      baseURL: process.env.OPEN_AI_BASEUEL,
    },
    ...options
  });
};

// 提取的 MilvusClient 实例化函数
export const createMilvusClient = () => {
  return new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT as string,
    token: process.env.ZILLIZ_API_KEY as string,
  });
};