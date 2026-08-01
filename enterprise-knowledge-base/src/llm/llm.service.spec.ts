import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { ChatOpenAI } from '@langchain/openai';

describe('LlmService', () => {
  let service: LlmService;
  let configService: ConfigService;

  const mockConfig: Record<string, any> = {
    ALIYUN_API_KEY: 'sk-aliyun-test',
    OPENAI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    OPENAI_MODEL_NAME: 'qwen3.6-plus',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => mockConfig[key] ?? defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('应该成功实例化 LlmService', () => {
    expect(service).toBeDefined();
  });

  it('应当能够使用默认配置正确创建 ChatOpenAI 实例', () => {
    const chatModel = service.createChatModel();

    expect(chatModel).toBeInstanceOf(ChatOpenAI);
    expect(chatModel.modelName || (chatModel as any).model).toBe('qwen3.6-plus');
    expect(chatModel.temperature).toBe(0.2);
    expect(chatModel.streaming).toBe(true);
  });

  it('应该支持通过 options 参数自定义重写配置', () => {
    const chatModel = service.createChatModel({
      modelName: 'gpt-4o',
      temperature: 0.7,
      streaming: false,
      maxRetries: 5,
    });

    expect(chatModel).toBeInstanceOf(ChatOpenAI);
    expect(chatModel.modelName || (chatModel as any).model).toBe('gpt-4o');
    expect(chatModel.temperature).toBe(0.7);
    expect(chatModel.streaming).toBe(false);
    const maxRetries = chatModel.maxRetries ?? (chatModel as any).caller?.maxRetries;
    expect(maxRetries).toBe(5);
  });
});
