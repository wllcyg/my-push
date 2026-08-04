import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

/**
 * 创建 Bocha AI (博查 AI) 互联网 Web 搜索工具
 *
 * 当本地企业知识库未检索到相关内容，或者用户询问最新外部新闻、实时技术文档、开源库最新动态时调用此工具
 *
 * @param configService NestJS ConfigService（可选，若未传则尝试读取 process.env.BOCHA_API_KEY）
 */
export function createBochaWebSearchTool(configService?: ConfigService) {
  return new DynamicStructuredTool({
    name: 'web_search',
    description:
      '当企业本地知识库未检索到相关内容，或者用户询问最新外部新闻、实时技术文档、开源库最新版本/动态或实时信息时，调用此工具进行互联网 Web 搜索。',
    schema: z.object({
      query: z
        .string()
        .describe('用于在互联网搜索引擎检索的核心关键词或短语（建议精简，提炼核心词）'),
    }),
    func: async ({ query }) => {
      console.log(`\n🌐 [Bocha AI Search Tool] 正在触发互联网搜索... query="${query}"`);

      const apiKey =
        configService?.get<string>('BOCHA_API_KEY') || process.env.BOCHA_API_KEY;

      if (!apiKey) {
        console.warn('⚠️ [Bocha AI Search Tool] 未配置 BOCHA_API_KEY 环境变量');
        return '未配置 Bocha AI 搜索 API Key，无法执行联网搜索。';
      }

      try {
        const response = await fetch('https://api.bochaai.com/v1/web-search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            freshness: 'noLimit',
            summary: true,
            count: 4,
            page: 1,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(
            `❌ [Bocha AI Search Tool] 请求失败 HTTP ${response.status}: ${errText}`,
          );
          return `联网搜索接口返回错误状态: HTTP ${response.status}`;
        }

        const resData = await response.json();

        // 兼容博查 AI 多种可能返回的 JSON 结构 (data.webPages.value / webPages.value / data.value / data.results)
        const pages: Array<{
          name?: string;
          title?: string;
          url?: string;
          snippet?: string;
          summary?: string;
          siteName?: string;
        }> =
          resData?.data?.webPages?.value ||
          resData?.webPages?.value ||
          resData?.data?.value ||
          resData?.data?.results ||
          [];

        if (!pages || pages.length === 0) {
          return `互联网搜索未找到关于 "${query}" 的相关网页结果。`;
        }

        console.log(
          `✅ [Bocha AI Search Tool] 检索成功，命中获取到了 ${pages.length} 条网页结果`,
        );

        const formattedResults = pages
          .map((page, idx) => {
            const title = page.name || page.title || '网页链接';
            const url = page.url || '';
            const content = page.summary || page.snippet || '无摘要内容';
            const site = page.siteName ? ` (来源: ${page.siteName})` : '';

            return `【网页结果 ${idx + 1}】《${title}》${site}\n链接: ${url}\n摘要: ${content}`;
          })
          .join('\n\n');

        return formattedResults;
      } catch (error) {
        console.error(
          '❌ [Bocha AI Search Tool] 联网搜索发生异常:',
          (error as Error).message,
        );
        return `联网搜索执行异常: ${(error as Error).message}`;
      }
    },
  });
}
