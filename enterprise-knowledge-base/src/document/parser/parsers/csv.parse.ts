import { cleanMarkdown, toMarkdownTable } from '@/document/parser/utils/markdown.util';

/**
 * 将 CSV 文本 Buffer 解析为 Markdown 表格。
 *
 * 流程：
 * 1. 自动剥离 UTF-8 BOM 头（防止 Windows Excel 导出的首字段带不可见字符 \uFEFF）；
 * 2. 解析行与列（正确处理双引号括起的逗号与换行）；
 * 3. 动态计算最大列数并补齐对齐，换行转为 <br>；
 * 4. 使用 toMarkdownTable 转化为标准 GFM Markdown 表格；
 * 5. cleanMarkdown 规范化空白与换行。
 */
export async function parseCsv(buffer: Buffer): Promise<string> {
  if (!buffer?.length) return '';

  const text = stripBom(buffer.toString('utf-8'));
  const rows = parseCsvRows(text);

  if (!rows.length) return '';

  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalized = rows.map((r) => {
    const copy = r.map(escapeMarkdownCell);
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  return cleanMarkdown(toMarkdownTable(normalized));
}

/**
 * 去除 UTF-8 BOM（0xFEFF），防止表头首字段带不可见字符
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * 转义会破坏 Markdown 表格结构的字符：
 * - 竖线 | 会被误认为列分隔符
 * - 换行符替换为 <br> 保留单元格内排版
 */
function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

/**
 * 将 CSV 文本内容解析为二维数组 (string[][])
 * 兼容 CRLF / LF 换行以及双引号转义
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // 双引号转义 "" -> "
        currentCell += '"';
        i++;
      } else {
        // 开启或关闭引号状态
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // 单元格分隔
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // 行分隔
      if (char === '\r' && nextChar === '\n') {
        i++; // 跳过 \n
      }
      currentRow.push(currentCell);
      if (currentRow.some((c) => c.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // 最后一行的未刷盘数据
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((c) => c.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}
