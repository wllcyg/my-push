import ExcelJS from 'exceljs';
import { parseXlsx } from './xlsx.parse';

describe('parseXlsx', () => {
  it('应正确将带有多个 Sheet 的 XLSX 文件解析为 Markdown 表格', async () => {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: 员工表
    const sheet1 = workbook.addWorksheet('员工名单');
    sheet1.addRow(['姓名', '职位', '部门']);
    sheet1.addRow(['张三', '前端工程师', '研发部']);
    sheet1.addRow(['李四', '产品经理', '产品部']);

    // Sheet 2: 财务预算
    const sheet2 = workbook.addWorksheet('预算明细');
    sheet2.addRow(['项目', '金额']);
    sheet2.addRow(['服务器', 50000]);

    const buffer = (await workbook.xlsx.writeBuffer()) as Buffer;

    const markdown = await parseXlsx(buffer);

    // 校验 Sheet1 标题与数据
    expect(markdown).toContain('## 员工名单');
    expect(markdown).toContain('| 姓名 | 职位 | 部门 |');
    expect(markdown).toContain('| 张三 | 前端工程师 | 研发部 |');

    // 校验 Sheet2 标题与数据
    expect(markdown).toContain('## 预算明细');
    expect(markdown).toContain('| 项目 | 金额 |');
    expect(markdown).toContain('| 服务器 | 50000 |');
  });

  it('应正确解析公式错误值（防 [object Object]）与内部换行符（换为 <br>）', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('特殊格式');
    sheet.addRow(['说明', '值']);

    // 单元格多行文本
    sheet.addRow(['多行内容', '第一行\n第二行']);

    // 公式计算错误单元格
    const row3 = sheet.addRow(['公式错误', '']);
    row3.getCell(2).value = { error: '#DIV/0!' } as any;

    const buffer = (await workbook.xlsx.writeBuffer()) as Buffer;
    const markdown = await parseXlsx(buffer);

    // 校验多行文本转 <br>
    expect(markdown).toContain('| 多行内容 | 第一行<br>第二行 |');

    // 校验公式错误不变成 [object Object]
    expect(markdown).toContain('| 公式错误 | #DIV/0! |');
    expect(markdown).not.toContain('[object Object]');
  });

  it('损坏的文件 Buffer 应抛出包裹后的错误信息', async () => {
    const invalidBuffer = Buffer.from('not an xlsx file');
    await expect(parseXlsx(invalidBuffer)).rejects.toThrow('XLSX 解析失败');
  });
});
