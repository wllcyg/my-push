import { model } from "@/model.js";
import { XMLOutputParser } from "@langchain/core/output_parsers";

async function runMain() {
  const parser = new XMLOutputParser();

  const prompt = `请提取以下文本中的人物信息：阿尔伯特·爱因斯坦出生于 1879 年，是一位伟大的物理学家,
    ${parser.getFormatInstructions()}
    `

  try {

    const response = await model.invoke(prompt)

    console.log(response.content);
  } catch (e) {
    console.error(e)
  }

}

runMain()