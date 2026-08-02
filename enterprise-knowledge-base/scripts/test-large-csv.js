"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const perf_hooks_1 = require("perf_hooks");
const csv_parse_1 = require("../src/document/parser/parsers/csv.parse");
function generateLargeCsv(count, includeBom = true) {
    const chunks = [];
    if (includeBom) {
        chunks.push('\uFEFF');
    }
    chunks.push('ID,员工姓名,部门信息,薪资,绩效评语,扩展属性\n');
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
        const extra = i % 2 === 0 ? `"标签: A${i}, B${i}"` : '';
        chunks.push(`${i},${name},${dept},${salary},${comment},${extra}\n`);
    }
    return Buffer.from(chunks.join(''), 'utf-8');
}
async function runBenchmark() {
    const args = process.argv.slice(2);
    const targetRows = args[0] ? parseInt(args[0], 10) : 50000;
    console.log(`==================================================`);
    console.log(`🚀 开始大数据量 CSV 解析测试`);
    console.log(`目标数据行数: ${targetRows.toLocaleString()} 行`);
    console.log(`==================================================\n`);
    const genStart = perf_hooks_1.performance.now();
    const csvBuffer = generateLargeCsv(targetRows, true);
    const genEnd = perf_hooks_1.performance.now();
    const genTime = genEnd - genStart;
    const csvSizeMB = csvBuffer.length / (1024 * 1024);
    console.log(`✅ CSV 生成完成！`);
    console.log(`   - 文件体积: ${csvSizeMB.toFixed(2)} MB`);
    console.log(`   - 生成耗时: ${genTime.toFixed(2)} ms\n`);
    const tempFilePath = path.join(__dirname, `large_test_${targetRows}.csv`);
    fs.writeFileSync(tempFilePath, csvBuffer);
    console.log(`📁 对应 CSV 文件已真实写入磁盘:`);
    console.log(`   👉 ${tempFilePath}\n`);
    if (global.gc) {
        global.gc();
    }
    const memBefore = process.memoryUsage().heapUsed;
    console.log(`⏳ 正在解析 CSV 并转换为 Markdown 表格...`);
    const parseStart = perf_hooks_1.performance.now();
    const markdownResult = await (0, csv_parse_1.parseCsv)(csvBuffer);
    const parseEnd = perf_hooks_1.performance.now();
    const memAfter = process.memoryUsage().heapUsed;
    const parseTime = parseEnd - parseStart;
    const memUsedMB = (memAfter - memBefore) / (1024 * 1024);
    const markdownLines = markdownResult.split('\n');
    console.log(`\n🎉 解析完成！测试指标结果如下：`);
    console.log(`--------------------------------------------------`);
    console.log(`📊 数据行数:         ${targetRows.toLocaleString()} 行`);
    console.log(`📦 CSV 大小:         ${csvSizeMB.toFixed(2)} MB`);
    console.log(`⏱️ 解析耗时:         ${parseTime.toFixed(2)} ms (${(parseTime / 1000).toFixed(2)} 秒)`);
    console.log(`💾 内存增加量:       ${memUsedMB.toFixed(2)} MB`);
    console.log(`📝 生成 Markdown 行: ${markdownLines.length.toLocaleString()} 行`);
    console.log(`--------------------------------------------------\n`);
    console.log(`🔍 执行解析结果正确性抽查...`);
    const headerLine = markdownLines[0];
    console.log(`  [1] 表头行: ${headerLine}`);
    if (headerLine.includes('\uFEFF')) {
        console.error(`  ❌ ERROR: Markdown 表头中仍残存 BOM 字符！`);
    }
    else {
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
//# sourceMappingURL=test-large-csv.js.map