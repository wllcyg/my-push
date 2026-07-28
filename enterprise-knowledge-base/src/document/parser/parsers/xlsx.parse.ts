import ExcelJS from 'exceljs';
import { cleanMarkdown, toMarkdownTable } from '../utils/markdown.util';

/**
 * 将 XLSX / XLS 解析为 Markdown。
 *
 * 整体流程：
 * 1. exceljs 加载工作簿；
 * 2. 每个 Sheet → `## SheetName` + Markdown 表格（首行作表头）；
 * 3. 单元格值经 cellToString 统一成字符串（公式取 result、公式错误值、超链接、富文本等）；
 * 4. 列数按整表最大列对齐后交给 toMarkdownTable。
 *
 * 空 Sheet 仍保留标题与空行，避免丢 sheet 名信息。
 */
export async function parseXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch (err) {
    throw new Error(`XLSX 解析失败: ${(err as Error).message}`);
  }

  const parts: string[] = [];

  workbook.eachSheet((sheet) => {
    parts.push(`## ${sheet.name}\n`);

    const rows: string[][] = [];
    let maxCols = 0;

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as Array<ExcelJS.CellValue | undefined>;
      const cells: string[] = [];
      // exceljs row.values 下标从 1 开始；actualCellCount 可能小于稀疏行的真实末列
      const last = Math.max(row.actualCellCount, (values?.length ?? 1) - 1);
      maxCols = Math.max(maxCols, last);
      for (let c = 1; c <= last; c++) {
        cells.push(cellToString(row.getCell(c).value));
      }
      rows.push(cells);
    });

    if (maxCols === 0 || rows.length === 0) {
      parts.push('\n');
      return;
    }

    // 各行列数可能不等，右侧补空串再出表
    const normalized = rows.map((r) => {
      const copy = [...r];
      while (copy.length < maxCols) copy.push('');
      return copy;
    });

    parts.push(toMarkdownTable(normalized));
  });

  return cleanMarkdown(parts.join('\n'));
}

/**
 * 将 exceljs 单元格值转为展示用字符串。
 * 兼容：原始类型、Date、公式（取 result）、公式错误值、超链接（取 text）、富文本、共享公式。
 * 无法识别的对象退回 String(value)。
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';

  if (typeof value === 'string') return escapeMarkdownCell(value);
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    // 公式错误值：{ error: '#DIV/0!' } —— 必须放在 result 判断之前，
    // 否则会 fall through 到 String(value) 变成 [object Object]
    if ('error' in value && typeof value.error === 'string') {
      return value.error;
    }
    // 公式单元格：优先展示计算结果
    if ('result' in value && value.result != null) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    // 超链接等：{ text, hyperlink }
    if ('text' in value && typeof value.text === 'string') {
      return escapeMarkdownCell(value.text);
    }
    // 富文本：拼接各 run
    if ('richText' in value && Array.isArray(value.richText)) {
      return escapeMarkdownCell(value.richText.map((t) => t.text).join(''));
    }
    // 仅有公式、尚未/无法拿到 result
    if ('sharedFormula' in value || 'formula' in value) {
      const result = (value as { result?: ExcelJS.CellValue }).result;
      return result != null ? cellToString(result) : '';
    }
  }

  return String(value);
}

/**
 * 转义会破坏 Markdown 表格结构的字符：
 * - 竖线 | 会被误认为列分隔符
 * - 换行符会把当前行撑断，替换为 <br>
 */
function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}
