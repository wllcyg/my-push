import { model } from "./model.js"; // 注意由于我们在 Node 环境，后缀写 .js 或者是省略，但在 TypeScript ESM 中最好遵循配置

async function main() {
  const response = await model.invoke("介绍一下你自己");
  console.log(response.content);
}

main().catch(console.error);
