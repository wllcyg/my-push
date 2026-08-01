import { parseCsv } from './csv.parse';

describe('parseCsv', () => {
  it('应将基础 CSV 解析为标准的 GFM Markdown 表格', async () => {
    const csvContent = '姓名,职位,部门\n张三,前端工程师,研发部\n李四,产品经理,产品部';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const markdown = await parseCsv(buffer);

    expect(markdown).toContain('| 姓名 | 职位 | 部门 |');
    expect(markdown).toContain('| --- | --- | --- |');
    expect(markdown).toContain('| 张三 | 前端工程师 | 研发部 |');
    expect(markdown).toContain('| 李四 | 产品经理 | 产品部 |');
  });

  it('应正确剥离 UTF-8 BOM 头（0xFEFF）', async () => {
    // 包含 UTF-8 BOM 头 \uFEFF 的 CSV
    const bomCsvContent = '\uFEFFID,姓名,部门\n1,张三,研发部';
    const buffer = Buffer.from(bomCsvContent, 'utf-8');

    const markdown = await parseCsv(buffer);

    // 应该精确匹配 | ID | 而非包含隐藏字符
    expect(markdown).toContain('| ID | 姓名 | 部门 |');
    expect(markdown.charCodeAt(2)).not.toBe(0xfeff);
  });

  it('应正确处理双引号包含逗号与内部换行符（换为 <br>）', async () => {
    const csvContent = '名称,描述,价格\n"产品 A, 特别版","第一行\n第二行",100\n"产品 B ""高级版""",带双引号,200';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const markdown = await parseCsv(buffer);

    expect(markdown).toContain('| 产品 A, 特别版 | 第一行<br>第二行 | 100 |');
    expect(markdown).toContain('| 产品 B "高级版" | 带双引号 | 200 |');
  });

  it('缺列的行应自动补齐对齐', async () => {
    const csvContent = '列1,列2,列3\nA,B\nC,D,E';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const markdown = await parseCsv(buffer);

    expect(markdown).toContain('| A | B |  |');
    expect(markdown).toContain('| C | D | E |');
  });

  it('空 Buffer 应返回空字符串', async () => {
    const markdown = await parseCsv(Buffer.alloc(0));
    expect(markdown).toBe('');
  });

  it('应能正确解析大数据量 CSV (如 5000 行)', async () => {
    const rowsCount = 5000;
    const lines = ['ID,姓名,部门,评语'];
    for (let i = 1; i <= rowsCount; i++) {
      lines.push(`${i},用户_${i},"部门, 组${i}","评语|第${i}条"`);
    }
    const csvContent = lines.join('\n');
    const buffer = Buffer.from(csvContent, 'utf-8');

    const markdown = await parseCsv(buffer);

    const resultLines = markdown.split('\n');
    // 表头 + 分割线 + 5000 行数据 = 5002 行
    expect(resultLines.length).toBe(rowsCount + 2);
    expect(resultLines[0]).toContain('| ID | 姓名 | 部门 | 评语 |');
    expect(markdown).toContain('| 5000 | 用户_5000 | 部门, 组5000 |');
  });
});
