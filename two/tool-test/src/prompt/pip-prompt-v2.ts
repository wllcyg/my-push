import { PromptTemplate, PipelinePromptTemplate } from '@langchain/core/prompts'
import { personTemplate, contextPrompt } from './pip-prompt.js'
import { model } from '@/model.js';
import { printStream } from '@/utils.js';

const okrReviewTaskPrompt = PromptTemplate.fromTemplate(`以下是本季度与你所在团队相关的关键事实与数据（OKR 进展、重要事件等）：
{okr_facts}

请你基于这些信息，整理一份发给 {manager_name} 的【季度 OKR 回顾邮件】，重点包含：
1. 本季度整体达成情况（相对 OKR 的完成度）
2. 关键成果与亮点
3. 暴露出的主要问题 / 风险
4. 下季度的改进方向与优先级建议`);

const okrReviewFormatPrompt = PromptTemplate.fromTemplate(`请用 Markdown 写这封邮件，结构建议为：
1. 邮件开头（1-2 句话的问候 + 本邮件目的）
2. 本季度整体概览
3. 逐条 OKR 的回顾（可分小节）
4. 主要问题 / 风险
5. 下季度计划与请求支持

语气保持专业、克制但真诚，既让老板看到成绩，也能感受到你在主动暴露问题、寻求改进。`);


const okrReviewPipline = new PipelinePromptTemplate({
    pipelinePrompts: [
        { name: 'person_block', prompt: personTemplate },
        { name: 'context_block', prompt: contextPrompt },
        { name: 'okr_review_task_block', prompt: okrReviewTaskPrompt },
        { name: 'okr_review_format_block', prompt: okrReviewFormatPrompt },
    ],
    finalPrompt: PromptTemplate.fromTemplate(`
    {person_block}
    {context_block}
    {okr_review_task_block}
    {okr_review_format_block}

    现在请生成本季度的最终 OKR 回顾邮件：`)
})


async function runMain() {
    try {
        const pipelineFormatted = await okrReviewPipline.format({
            tone: "严谨、得体且不失诚恳",
            company_name: "忘忧科技",
            team_name: "AI 核心应用部",
            manager_name: "王总",
            week_range: "Q2 季度 (2026-04-01 ~ 2026-06-30)",
            team_goal: "打造行业一流的 AI Agent 与智能工作流解决方案",
            okr_facts: `
- KR 1 (100%): 成功上线 mini-cursor 编程助手 MVP 版，在内部试用中帮助团队日常编码效率提升 25%。
- KR 2 (90%): 重构了 LangChain 提示词管道流并解决 Zod Schema 与 JSON Schema 兼容报错。
- KR 3 (80%): 接入本地 TiDB Cloud 及 RAG 知识库，完成首批多租户数据隔离测试。
- 潜在风险: 随着用户并发增加，调用大模型提取结构化数据时的 API 响应延迟偶尔偏高。
            `
        });

        console.log("=== 组合完成的 OKR 回顾 Prompt ===");
        console.log(pipelineFormatted);
        console.log("\n=== 正在请求大模型生成季度 OKR 回顾邮件 ===\n");

        const stream = await model.stream(pipelineFormatted);
        await printStream(stream);

    } catch (error) {
        console.error("执行出错:", error);
    }
}
