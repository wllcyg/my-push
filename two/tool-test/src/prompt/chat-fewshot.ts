import { model } from "@/model.js";
import { ChatPromptTemplate, FewShotChatMessagePromptTemplate } from "@langchain/core/prompts";
import { printStream } from "@/utils.js";

// 1. few-shot 示例：每条示例是「human 问 + ai 答」的聊天片段
const EXAMPLES = [
  {
    input: '本周主要推进支付稳定性治理，做了事故处置、告警优化和演练。',
    output:
      '- 本周围绕支付链路稳定性开展治理工作：完成 1 起 P1 事故与 2 起 P2 事故的排查与修复，均在 SLA 内关闭；\n' +
      '- 梳理并合并冗余告警规则 8 条，新建 4 条基于 SLO 的告警，大幅降低无效告警噪音；\n' +
      '- 组织 1 次故障应急演练，验证支付核心链路的应急预案可行性。',
  },
  {
    input: '本周交付了新运营看板，并给业务同学做了多场分享。',
    output:
      '- 上线新一代「运营实时看板」，支持业务实时查看关键转化指标和漏斗数据；\n' +
      '- 衔接埋点、数据仓库与可视化链路，为后续精细化运营提供统一数据口径；\n' +
      '- 面向市场和运营团队组织 2 场产品培训，帮助非技术同学理解看板核心能力和使用场景。',
  },
];

// 2. 把上面的结构映射为 FewShotChatMessagePromptTemplate 可用的 examples
const fewShotExamples = new FewShotChatMessagePromptTemplate({
  examplePrompt: ChatPromptTemplate.fromMessages([
    [
      'human',
      '下面是本周的工作概述：\n{input}\n\n请帮我整理成适合发在团队周报里的要点列表。',
    ],
    ['ai', '{output}'],
  ]),
  examples: EXAMPLES,
  inputVariables: [], // 示例本身不依赖运行时变量
});

// 3. 把 few-shot 示例和最终用户输入组合成一个完整的 ChatPromptTemplate
const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    '你是一名资深技术负责人，请根据给定的工作内容，参考上面的示例，帮我写一段结构清晰、重点突出的周报片段（使用 Markdown 列表）。',
  ],
  [
    'system',
    '下面是若干参考示例，请重点学习它们的「表达方式和结构」，而不是照搬具体内容：',
  ],
  fewShotExamples as any, // 直接作为消息插入到对话流中
  [
    'human',
    '这是我本周的实际工作内容，请帮我整理成周报：\n{current_work}',
  ],
]);

// 4. 演示：给一个简单的当前工作内容，跑通整个链路
const currentWork =
  '本周完成了订单模块的一轮重构，拆分了历史遗留的大文件，并补齐了核心路径的单测；' +
  '同时修复了两起线上性能问题，并把指标接入统一监控看板。';

async function runMain() {
  try {
    // 组装成消息
    const messages = await chatPrompt.formatMessages({
      current_work: currentWork,
    });

    console.log('\n===== 1. 最终拼装发送给模型的 Chat 消息数组 =====\n');
    console.log(messages);

    console.log('\n===== 2. 正在流式调用大模型进行周报生成 =====\n');
    const stream = await model.stream(messages);
    await printStream(stream);
  } catch (error) {
    console.error("执行出错:", error);
  }
}

runMain();
