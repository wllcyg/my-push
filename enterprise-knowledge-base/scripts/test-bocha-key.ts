import 'dotenv/config';
import { createBochaWebSearchTool } from '../src/agent/tools/bocha-web-search.tool';


async function testBochaKey() {
  console.log('🔍 正在通过 Infisical / 环境变量获取 BOCHA_API_KEY...');
  const key = process.env.BOCHA_API_KEY;
  if (!key) {
    console.error('❌ 未能在当前环境变量中找到 BOCHA_API_KEY！请在 Infisical 或 .env 中配置。');
    process.exit(1);
  }

  console.log(`🔑 找到 BOCHA_API_KEY (前缀: ${key.slice(0, 6)}... 长度: ${key.length})`);
  console.log('🚀 开始向 https://api.bochaai.com/v1/web-search 发送真实测试搜索请求 (query: "NestJS 最新版本")...');

  const tool = createBochaWebSearchTool();
  const result = await tool.invoke({ query: 'NestJS 最新版本' });

  console.log('\n================ 真实 API 响应结果 ================\n');
  console.log(result);
  console.log('\n===================================================\n');

  if (
    result.includes('联网搜索接口返回错误状态') ||
    result.includes('未配置') ||
    result.includes('网络') ||
    result.includes('异常')
  ) {
    console.error('❌ Key 验证失败或接口响应异常！');
    process.exit(1);
  } else {
    console.log('🎉 测试通过！BOCHA_API_KEY 联通正常，已成功从博查 AI 获取到了真实网页结果！');
  }
}

testBochaKey().catch((err) => {
  console.error('❌ 脚本执行遇到未知致命异常:', err);
  process.exit(1);
});
