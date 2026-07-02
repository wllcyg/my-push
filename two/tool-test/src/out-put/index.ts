import { model } from "@/model.js";
import { StructuredOutputParser } from "@langchain/core/output_parsers"; // 可以定义一些输出结构，但是要会写prompt，否则会报错
import { JsonOutputParser } from "@langchain/core/output_parsers";

// 定义未json
async function test() {
  // 定义输出的结构
  const stringParse = StructuredOutputParser.fromNamesAndDescriptions({
    name: "string",
    english_name: "string",
    type: "string",
    moons_count: "number",
    notable_features: "array",
  })

  const parser = new JsonOutputParser();

  const question = `请介绍一下太阳系八大行星中的木星（Jupiter）。请以 JSON 格式返回，包含以下字段：name（中文名）、english_name（英文名）、type（行星类型）、moons_count（卫星数量）、notable_features（显著特征，数组）。
  ${parser.getFormatInstructions()}
  `;

  const question1 = `请介绍一下水星的信息
  ${stringParse.getFormatInstructions()}
  `
  try {
    console.log('开始调用大模型了...', question);

    const response = await model.invoke(question)
    const response1 = await model.invoke(question1)
    console.log(response.content);


    const result = await parser.parse(response.content as string)
    console.log(result);

    const result1 = await stringParse.parse(response1.content as string)
    console.log(result1);


  } catch (error) {
    console.error("获取大模型响应时出错:", error);
  }

}

test()
