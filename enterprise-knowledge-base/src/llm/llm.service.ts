import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

export interface CreateChatModelOptions {
  modelName?: string;
  temperature?: number;
  streaming?: boolean;
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 创建大语言模型 Chat 实例 (支持阿里百炼/OpenAI/DeepSeek 等兼容接口)
   */
  createChatModel(options?: CreateChatModelOptions): ChatOpenAI {
    const apiKey =
      options?.apiKey ||
      this.configService.get<string>('ALIYUN_API_KEY') ||
      this.configService.get<string>('OPENAI_API_KEY') ||
      'sk-mock';

    const baseUrl =
      options?.baseURL ||
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';

    const modelName =
      options?.modelName ||
      this.configService.get<string>('OPENAI_MODEL_NAME') ||
      'qwen3.6-plus';

    const temperature = options?.temperature ?? 0.2;
    const streaming = options?.streaming ?? true;
    const maxRetries = options?.maxRetries ?? 2;

    this.logger.log(
      `🤖 初始化 Chat Model 实例 | Model: ${modelName} | BaseURL: ${baseUrl} | Temperature: ${temperature}`,
    );

    return new ChatOpenAI({
      apiKey,
      configuration: {
        baseURL: baseUrl,
      },
      modelName,
      temperature,
      streaming,
      maxRetries,
    });
  }
}
