import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { parseCsv } from '../src/document/parser/parsers/csv.parse';

/**
 * 大数据量 CSV 生成与解析测试脚本
 *
 * 使用方法：
 * 1. 默认测试 50,000 行：
 *    npx ts-node scripts/test-large-csv.ts
 * 2. 指定行数（如 100,000 行）：
 *    npx ts-node scripts/test-large-csv.ts 100000
 */

/**
 * 生成大文本 CSV 内容 Buffer 并测试解析
 * @param count 行数
 * @param includeBom 是否包含 UTF-8 BOM 头
 */
function generateLargeCsv(count: number, includeBom = true): Buffer {
  const chunks: string[] = [];

  // 1. 添加 BOM 头 (\uFEFF)，测试 BOM 自动剥离
  if (includeBom) {
    chunks.push('\uFEFF');
  }

  // 2. 表头
  chunks.push('ID,员工姓名,部门信息,薪资,绩效评语,扩展属性\n');

  // 3. 生成各种复杂的行数据
  const departments = ['"研发部, 架构组"', '"产品部, UI/UX"', '运营部', '市场部'];
  const comments = [
    '"表现优异\n多次获得团队奖"',
    '"工作认真 | 沟通顺畅"',
    '"包含""双引号""转义"',
    '普通评语文本',
  ];

  for (let i = 1; i <= count; i++) {
    const name = `员工_${i}`;
    const dept = departments[i % departments.length];
    const salary = (8000 + (i % 20) * 1000).toString();
    const comment = comments[i % comments.length];
    // 偶数行附带额外属性，奇数行测试可能缺列的场景
    const extra = i % 2 === 0 ? `"标签: A${i}, B${i}"` : '';

    chunks.push(`${i},${name},${dept},${salary},${comment},${extra}\n`);
  }

  return Buffer.from(chunks.join(''), 'utf-8');
}

/**
 * 执行测试基准
 */
async function runBenchmark() {
  // 解析命令行传入的行数参数，默认为 50,000 行
  const args = process.argv.slice(2);
  const targetRows = args[0] ? parseInt(args[0], 10) : 50000;

  console.log(`==================================================`);
  console.log(`🚀 开始大数据量 CSV 解析测试`);
  console.log(`目标数据行数: ${targetRows.toLocaleString()} 行`);
  console.log(`==================================================\n`);

  // 1. 测试 CSV 生成
  const genStart = performance.now();
  const csvBuffer = generateLargeCsv(targetRows, true);
  const genEnd = performance.now();
  const genTime = genEnd - genStart;

  const csvSizeMB = csvBuffer.length / (1024 * 1024);
  console.log(`✅ CSV 生成完成！`);
  console.log(`   - 文件体积: ${csvSizeMB.toFixed(2)} MB`);
  console.log(`   - 生成耗时: ${genTime.toFixed(2)} ms\n`);

  // 2. 保存真正的 CSV 文件至本地磁盘
  const tempFilePath = path.join(__dirname, `large_test_${targetRows}.csv`);
  fs.writeFileSync(tempFilePath, csvBuffer);
  console.log(`📁 对应 CSV 文件已真实写入磁盘:`);
  console.log(`   👉 ${tempFilePath}\n`);

  // 3. 测量 GC & 内存起点
  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage().heapUsed;

  // 4. 执行 parseCsv 解析
  console.log(`⏳ 正在解析 CSV 并转换为 Markdown 表格...`);
  const parseStart = performance.now();
  const markdownResult = await parseCsv(csvBuffer);
  const parseEnd = performance.now();

  const memAfter = process.memoryUsage().heapUsed;
  const parseTime = parseEnd - parseStart;
  const memUsedMB = (memAfter - memBefore) / (1024 * 1024);

  // 统计 Markdown 结果的行数
  const markdownLines = markdownResult.split('\n');

  console.log(`\n🎉 解析完成！测试指标结果如下：`);
  console.log(`--------------------------------------------------`);
  console.log(`📊 数据行数:         ${targetRows.toLocaleString()} 行`);
  console.log(`📦 CSV 大小:         ${csvSizeMB.toFixed(2)} MB`);
  console.log(`⏱️ 解析耗时:         ${parseTime.toFixed(2)} ms (${(parseTime / 1000).toFixed(2)} 秒)`);
  console.log(`💾 内存增加量:       ${memUsedMB.toFixed(2)} MB`);
  console.log(`📝 生成 Markdown 行: ${markdownLines.length.toLocaleString()} 行`);
  console.log(`--------------------------------------------------\n`);

  // 5. 基础正确性校验
  console.log(`🔍 执行解析结果正确性抽查...`);
  const headerLine = markdownLines[0];
  console.log(`  [1] 表头行: ${headerLine}`);
  
  if (headerLine.includes('\uFEFF')) {
    console.error(`  ❌ ERROR: Markdown 表头中仍残存 BOM 字符！`);
  } else {
    console.log(`  ✅ UTF-8 BOM 字符成功去除`);
  }

  const hasBr = markdownResult.includes('<br>');
  console.log(`  ${hasBr ? '✅' : '❌'} 单元格换行转义为 <br>: ${hasBr}`);

  const hasEscapedPipe = markdownResult.includes('\\|');
  console.log(`  ${hasEscapedPipe ? '✅' : '❌'} 管道符 | 转义为 \\|: ${hasEscapedPipe}`);

  console.log(`\n✨ 大数据量 CSV 解析测试结束！您可以直接在磁盘打开生成的 csv 文件查看。\n`);
}

runBenchmark().catch((err) => {
  console.error('❌ 测试运行失败:', err);
});
