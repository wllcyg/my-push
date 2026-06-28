import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

// 封装一个默认的模型实例，以后到处直接引入即可
export const model = new ChatOpenAI({
  model: "qwen3.7-plus",
  apiKey: process.env.ALIYUN_API_KEY, 
  configuration: {
    baseURL: "https://ws-zltje74rc65q4wpd.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  },
});

// 如果以后需要创建不同参数的模型（比如调整 temperature），也可以导出一个工厂函数
export const createModel = (options?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>) => {
  return new ChatOpenAI({
    model: "qwen3.7-plus",
    apiKey: process.env.ALIYUN_API_KEY, 
    configuration: {
      baseURL: "https://ws-zltje74rc65q4wpd.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    },
    ...options
  });
};
