import { createBochaWebSearchTool } from './bocha-web-search.tool';
import { ConfigService } from '@nestjs/config';

describe('BochaWebSearchTool', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalFetch = global.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('当未配置 BOCHA_API_KEY 时应返回警告提示', async () => {
    delete process.env.BOCHA_API_KEY;
    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const tool = createBochaWebSearchTool(mockConfigService);
    const result = await tool.invoke({ query: 'NestJS' });

    expect(result).toContain('未配置 Bocha AI 搜索 API Key');
  });

  it('成功检索并格式化 Bocha AI 返回的结果', async () => {
    process.env.BOCHA_API_KEY = 'test_key';

    const mockResponseData = {
      code: 200,
      data: {
        webPages: {
          value: [
            {
              name: 'NestJS 官方文档',
              url: 'https://nestjs.com',
              summary: 'NestJS 是一个用于构建高效、可靠和可扩展的 Node.js 服务端应用程序的框架。',
              siteName: 'NestJS Docs',
            },
          ],
        },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponseData),
    } as any);

    const tool = createBochaWebSearchTool();
    const result = await tool.invoke({ query: 'NestJS' });

    expect(result).toContain('【网页结果 1】《NestJS 官方文档》');
    expect(result).toContain('链接: https://nestjs.com');
    expect(result).toContain('NestJS Docs');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.bochaai.com/v1/web-search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test_key',
        }),
      }),
    );
  });

  it('当 HTTP 请求响应失败时应捕获错误状态', async () => {
    process.env.BOCHA_API_KEY = 'test_key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Error'),
    } as any);

    const tool = createBochaWebSearchTool();
    const result = await tool.invoke({ query: 'NestJS' });

    expect(result).toContain('联网搜索接口返回错误状态: HTTP 500');
  });
});
