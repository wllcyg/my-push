// 这是关于提示词的,最基础的占位符模板

import { model } from "@/model.js";
import { PromptTemplate } from "@langchain/core/prompts";
import { printStream } from "@/utils.js";

async function runMain() {


    const nativePrompt = PromptTemplate.fromTemplate(
        `你是一名严谨但不失人情味的工程团队负责人，需要根据本周数据写一份周报。

公司名称: {company_name}
部门名称: {team_name}
直接汇报对象: {manager_name}
本周时间范围: {week_range}

本周团队核心目标:
{team_goal}

本周开发数据 (Git 提交 / Jira 任务):
{dev_activities}

请根据以上信息生成一份【Markdown 周报】，要求：
- 有简短的整体 summary (两三句话)
- 有按模块/项目拆分的小结
- 用一个 Markdown 表格列出关键指标 (字段示例：模块 / 亮点 / 风险 / 下周计划)
- 语气专业但有一点人情味，适合作为给老板和团队抄送的周报。`
    );

    const formattedPrompt = await nativePrompt.format({
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
    });

    console.log("=== 格式化后的 Prompt ===");
    console.log(formattedPrompt);
    console.log("\n=== 正在请求大模型生成周报 ===\n");

    try {
        const response = await model.stream(formattedPrompt);
        await printStream(response);
    } catch (error) {
        console.error("调用大模型出错:", error);
    }
}

runMain();