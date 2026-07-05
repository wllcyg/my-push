import "dotenv/config";
import { model, embeddingModel } from "@/model.js";
import { FewShotPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { printStream } from "@/utils.js";

const COLLECTION_NAME = "weekly_report_examples";

// 1. 定义单条示例 Prompt 模板
const examplePrompt = PromptTemplate.fromTemplate(
  `用户场景：{scenario}
生成的周报片段：
{report_snippet}
---`
);



async function runTest(currentScenario: string) {
    // 1. 基于已存在的集合创建向量库 (与你发我的代码一致)
    const vectorStore = await Milvus.fromExistingCollection(embeddingModel, {
        collectionName: COLLECTION_NAME,
        clientConfig: {
            address: process.env.ZILLIZ_ENDPOINT as string,
            token: process.env.ZILLIZ_API_KEY as string,
        },
    });

    // 2. 实例化 SemanticSimilarityExampleSelector
    const exampleSelector = new SemanticSimilarityExampleSelector({
        vectorStore,
        k: 2, // 每次只选出语义上最相近的 2 条示例
    });

    // 3. 用 selector 构建 FewShotPromptTemplate
    const fewShotPrompt = new FewShotPromptTemplate({
        examplePrompt,
        exampleSelector,
        prefix:
            '下面是一些不同类型的周报示例，你可以从中学习语气和结构（系统会自动从 Milvus 选出和当前场景最相近的示例）：\n',
        suffix:
            '\n\n现在请根据上面的示例风格，为下面这个场景写一份新的周报：\n' +
            '场景描述：{current_scenario}\n' +
            '请输出一份适合发给老板和团队同步的 Markdown 周报草稿。',
        inputVariables: ['current_scenario'],
    });

    // 4. 格式化最终的 Few-Shot Prompt
    const formattedPrompt = await fewShotPrompt.format({
        current_scenario: currentScenario,
    });

    console.log(`\n==================================================`);
    console.log(`【测试场景】: ${currentScenario}`);
    console.log(`==================================================`);
    console.log(formattedPrompt);

    console.log("\n=== 正在流式调用大模型生成周报 ===\n");
    const stream = await model.stream(formattedPrompt);
    await printStream(stream);
}

async function runMain() {
    // 场景 1：偏“重构/技术债”语义
    const scenario1 = "这周没上什么大功能，主要是在对账模块写单测，把覆盖率提到了 90%，顺便重构了两个陈旧的类。";
    await runTest(scenario1);

    // 场景 2：偏“对外发布/首发上线”语义
    const scenario2 = "本周我们把新的结算报表发布到了生产环境，邀请了财务部的同事开始试用，并收集了第一批反馈。";
    await runTest(scenario2);
}

runMain();
