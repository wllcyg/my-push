import mammoth from 'mammoth';
import TurndownService from 'turndown';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { gfm } = require('turndown-plugin-gfm') as {
  gfm: (service: TurndownService) => void;
};
import { cleanMarkdown } from '@/document/parser/utils/markdown.util';

export interface ParseDocxOptions {
  /** 是否全量忽略图片 */
  ignoreImages?: boolean;
  /** 自定义图片上传回调 (如上传至 Cloudflare R2 / OSS 并返回 URL) */
  uploadImage?: (imageBuffer: Buffer, contentType: string) => Promise<string>;
}

/**
 * 将 DOCX 解析为 Markdown。
 *
 * 整体流程：
 * 1. mammoth 把 DOCX 转为 HTML（保留标题 / 列表 / 表格等结构）；
 * 2. 支持通过 uploadImage 回调拦截内嵌图片并上传（如 Cloudflare R2）；
 * 3. turndown(+GFM) 把 HTML 转为 Markdown；
 * 4. cleanMarkdown 做换行与空白规范化。
 */
export async function parseDocx(
  buffer: Buffer,
  options?: ParseDocxOptions,
): Promise<string> {
  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        // 英文样式
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        // 中文 Word 内置「标题 N」
        "p[style-name='标题 1'] => h1:fresh",
        "p[style-name='标题 2'] => h2:fresh",
        "p[style-name='标题 3'] => h3:fresh",
        "p[style-name='标题 4'] => h4:fresh",
        "p[style-name='标题 5'] => h5:fresh",
        "p[style-name='标题 6'] => h6:fresh",
      ],

      // 图片转换钩子：如果提供了 uploadImage（如 R2 上传）则上传并使用网络 URL
      convertImage: options?.uploadImage
        ? mammoth.images.imgElement(async (element) => {
          const imageBuffer = await element.read();
          const mimeType = element.contentType;
          const publicUrl = await options.uploadImage!(imageBuffer, mimeType);
          return { src: publicUrl };
        })
        : options?.ignoreImages
          ? mammoth.images.imgElement(() => Promise.resolve({ src: '' }))
          : undefined,
    },
  );

  if (messages && messages.length > 0) {
    // 可记录解析警告日志
  }

  const turndown = new TurndownService({
    headingStyle: 'atx', // # 标题格式
    codeBlockStyle: 'fenced', // ```代码块格式
    bulletListMarker: '-',
    hr: '---',
  });

  // GFM：表格、删除线、任务列表等扩展语法
  turndown.use(gfm);

  return cleanMarkdown(turndown.turndown(html));
}
