import { model } from "@/model.js";
import { JsonOutputParser } from "@langchain/core/output_parsers";
// 定义未json
async function test() {


  const parser = new JsonOutputParser();

  const question = `请介绍一下太阳系八大行星中的木星（Jupiter）。请以 JSON 格式返回，包含以下字段：name（中文名）、english_name（英文名）、type（行星类型）、moons_count（卫星数量）、notable_features（显著特征，数组）。
  ${parser.getFormatInstructions()}
  `;
  try {
    console.log('开始调用大模型了...', question);

    const response = await model.invoke(question)
    console.log(response.content);

    const result = await parser.parse(response.content as string)
    console.log(result);


  } catch (error) {
    console.error("获取大模型响应时出错:", error);
  }

}

test()
