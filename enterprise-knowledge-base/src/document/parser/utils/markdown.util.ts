/**
 * 规范化 Markdown 文本，去除冗余空行与无用空白字符。
 */
export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * 转义表格单元格中的 `|`，并把换行压成空格，避免破坏表结构。
 */
export function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/**
 * 二维数组 → Markdown 表格（首行作表头，第二行输出 `| --- |` 分隔）。
 * 列数按所有行的最大列对齐，缺省单元格视为空串。
 */
export function toMarkdownTable(rows: string[][]): string {
  if (!rows.length) return '';

  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxCols === 0) return '';

  const lines: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cells: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      cells.push(escapeTableCell(rows[r][c] ?? ''));
    }
    lines.push(`| ${cells.join(' | ')} |`);
    if (r === 0) {
      lines.push(`| ${Array(maxCols).fill('---').join(' | ')} |`);
    }
  }
  return `${lines.join('\n')}\n\n`;
}

/**
 * 取文件扩展名（小写，不含点）；无扩展名时返回空串。
 */
export function getExtension(filename?: string | null): string {
  if (!filename || !filename.includes('.')) return '';
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

/**
 * Multer/busboy 常把 multipart 文件名的 UTF-8 字节按 Latin-1 解码，
 * 导致中文变成乱码「ç³è®º…」。按 Latin-1 取回原始字节再按 UTF-8 还原。
 */
export function decodeUploadFilename(filename?: string | null): string {
  if (!filename) return '';
  try {
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');
    // 解码失败会出现替换字符 \uFFFD，此时保留原值
    if (decoded.includes('\uFFFD')) return filename;
    return decoded;
  } catch {
    return filename;
  }
}

/**
 * 去掉扩展名作为文档标题；空文件名时返回「未命名文档」。
 */
export function titleFromFilename(filename?: string | null): string {
  if (!filename) return '未命名文档';
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(0, idx) : filename;
}
