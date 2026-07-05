import { model } from "@/model.js";
import { FewShotPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { printStream } from "@/utils.js";
const examplesPrompt = PromptTemplate.fromTemplate(`用户输入: {user_requirement}
期望周报结构: {expected_style}
模型示例输出片段:
{report_snippet}`);


const examples = [
    {
        user_requirement: '重点突出稳定性治理，本周主要在修 Bug 和清理技术债，适合发给偏关注风险的老板。',
        expected_style: '语气稳健、偏保守，多强调风险识别和已做的兜底动作。',
        report_snippet:
            '- 支付链路本周共处理线上 P1 Bug 2 个、P2 Bug 3 个，全部在 SLA 内完成修复；\n' +
            '- 针对历史高频超时问题，完成 3 个核心接口的超时阈值和重试策略优化；\n' +
            '- 清理 12 条重复/噪音告警，减少值班同学 30% 的告警打扰。',
    },
    {
        user_requirement: '偏向对外展示成果，希望多写一些亮点，适合发给更大范围的跨部门同学。',
        expected_style: '语气积极、突出成果，对技术细节做适度抽象。',
        report_snippet:
            '- 新上线「订单实时看板」，业务侧可以实时查看核心转化漏斗；\n' +
            '- 首次打通埋点 ➔ 数据仓库 ➔ 实时服务链路，为后续精细化运营提供基础能力；\n' +
            '- 和产品、运营一起完成 2 场内部分享，会后收到 15 条正向反馈。',
    }
];


// 创建 FewShotPromptTemplate (静态示例块生成器)
const fewShotPrompt = new FewShotPromptTemplate({
    examples,
    examplePrompt: examplesPrompt,
    prefix: "下面是几条已经写好的【周报示例】，你可以从中学习语气、结构和信息组织方式：\n",
    suffix: "\n基于上面的示例风格，请帮我写一份新的周报。\n如果用户有额外要求，请在满足要求的前提下，尽量保持示例中的结构和条理性。",
    inputVariables: []
});

async function runMain() {
    try {
        // 1. 生成静态的 Few-Shot 示例块
        const fewShotBlock = await fewShotPrompt.format({});
        console.log("=== 1. 生成的静态 Few-Shot 示例块 ===");
        console.log(fewShotBlock);
        console.log("\n--------------------------------------------------\n");

        // 2. 将示例块拼接到 ChatPromptTemplate 的 system 提示词中
        const chatPrompt = ChatPromptTemplate.fromMessages([
            [
                "system",
                `你是一名资深的研发团队 Leader，擅长写高质量技术周报。

{few_shot_block}`
            ],
            [
                "human",
                `这是我的本周工作数据，请帮我生成周报：
用户输入: {user_requirement}
期望周报结构: {expected_style}`
            ]
        ]);

        // 3. 格式化最终的 Chat 提示词
        const formattedMessages = await chatPrompt.formatMessages({
            few_shot_block: fewShotBlock,
            user_requirement: "本周主要是进行大促前的性能压测与限流预案演练，确保系统在大促期间不挂掉。",
            expected_style: "语气严肃、技术细节详实、用具体指标说话，给高管汇报。"
        });

        console.log("=== 2. 最终拼装并注入示例后的 Chat 消息列表 ===");
        console.log(formattedMessages);

        console.log("\n=== 3. 正在流式调用大模型生成周报 ===\n");
        const stream = await model.stream(formattedMessages);
        await printStream(stream);

    } catch (error) {
        console.error("执行出错:", error);
    }
}

runMain();