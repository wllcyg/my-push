import { model } from "@/model.js";
import { PipelinePromptTemplate, PromptTemplate } from "@langchain/core/prompts";

// 基础描述人设

export const personTemplate = PromptTemplate.fromTemplate(
    `
你是一个团队的负责人,写作风格:{tone}
你擅长把枯燥的技术谢姐写得既专业又有温度 \n
`
)

// 背景模块

export const contextPrompt = PromptTemplate.fromTemplate(`
公司: {company_name}
部门: {team_name}
直接汇报对象: {manager_name}
本周时间范围: {week_range}
本周部门核心目标: {team_goal}\n
`);

// 任务模块
const taskPrompt = PromptTemplate.fromTemplate(
    `以下是本周团队的开发活动 (Git / Jira 汇总):
{dev_activities}

请你从这些原始数据中提炼出:
1. 本周整体成就亮点
2. 潜在风险和技术债
3. 下周重点计划建议\n`
);

// 格式模块
const formatPrompt = PromptTemplate.fromTemplate(
    `请用 Markdown 输出周报，结构包含:
1. 本周概览 (2-3 句话的 Summary)
2. 详细拆分 (按模块或项目分段)
3. 关键指标表格，表头为: 模块 | 亮点 | 风险 | 下周计划

注意:
- 尽量引用一些具体数据（如提交次数、完成的任务编号）
- 语气专业，但可以偶尔带一点轻松的口谣，符合 {company_values}。`
);

// E. 最终组合 Prompt (把上面几个模块拼在一起)
const finalWeeklyPrompt = PromptTemplate.fromTemplate(
    `{person_block}
{context_block}
{task_block}
{format_block}

现在请生成本周的最终周报：`
);

// F. 构建 PipelinePromptTemplate
// 💡 核心修正：Pipeline 中每一个子模版的 name 必须与 finalPrompt 中的占位符完全一致（不需要自动加后缀，必须严格 1:1 匹配）。
export const pipeline = new PipelinePromptTemplate({
    pipelinePrompts: [
        {
            name: 'person_block',
            prompt: personTemplate
        },
        {
            name: 'context_block',
            prompt: contextPrompt
        },
        {
            name: 'task_block',
            prompt: taskPrompt
        },
        {
            name: 'format_block',
            prompt: formatPrompt
        }
    ],
    finalPrompt: finalWeeklyPrompt,
});

async function runMain() {
    const pipelineFormatted = await pipeline.format({
        tone: "幽默风趣且专业",
        company_values: "拥抱变化、客户至上",
        company_name: "忘忧科技",
        team_name: "AI 应用开发组",
        manager_name: "王总",
        week_range: "2026-06-29 ~ 2026-07-04",
        team_goal: "完成 AI Agent 编程助手（mini-cursor）的 MVP 版本开发与流式解析调优",
        dev_activities: `
- git commit: feat: 引入 JsonOutputToolsParser 实现了 write_file 工具的流式打字机预览
- git commit: fix: 修复了子进程执行命令时 cd 丢失路径上下文的 bug
- Jira-1024: 调试完成本地 MySQL 多表关联查询及测试数据录入脚本开发
- Code Review: 配合团队完成了提示词工程（Prompt Engineering）的配置模块重构
        `
    })

    console.log("=== 组合拼接后的最终 Prompt ===");
    console.log(pipelineFormatted);

}
