import { getCurrentTimeFormatted } from '../agent.utils';

export interface SystemPromptRenderOptions {
  skillManifest?: string;
  matchedSkills?: string;
  currentTime?: string;
}

/**
 * 基础系统提示词模板
 */
export const SYSTEM_BASE_PROMPT_TEMPLATE = `你是一个专业、严谨的企业 AI 智能助手。你的目标是帮助用户回答技术、业务、文档、员工规范及实时资讯相关问题。
当前系统时间：{currentTime}
规则：
1. 当用户的问题涉及企业具体技术、文档规范、简历或业务内容时，你必须且优先调用 \`knowledge_retriever\` 工具在知识库中进行向量检索。
2. 如果本地知识库未检索到相关内容，或者用户询问最新外部新闻、实时技术文档、开源库最新动态或实时信息时，请调用 \`web_search\` 工具进行互联网搜索。
3. 基于检索到的切片或网页结果准确作答，并在回答中以 \`[1]\`、\`[2]\` 角标标注出处。
4. 若本地库和联网搜索均未找到相关信息，请诚实告知用户，不要胡乱编造。{skillManifest}{skillOverrideDirective}{matchedSkills}`;

/**
 * 专有技能高优先级覆盖指令模板
 */
export const SKILL_OVERRIDE_PROMPT_TEMPLATE = `

🚨🚨🚨【最高优先级强指令 - 覆盖默认行为】🚨🚨🚨
当前用户提问已精确触发了系统专有技能 (Skill)。你必须 100% 无条件且严格遵守下方 Skill 文件的格式与交互规范！
【特别警告】：若属于图表/画图/数据可视化需求，绝对禁止提供 Python/matplotlib 代码，绝对禁止要求用户本地运行脚本，必须直接且仅输出 \`\`\`json:echarts 动态图表代码块以供前端组件直接渲染！`;

/**
 * 渲染专有技能优先级覆盖提醒
 */
export function renderSkillOverrideDirective(matchedSkills?: string): string {
  if (!matchedSkills) return '';
  return SKILL_OVERRIDE_PROMPT_TEMPLATE;
}

/**
 * 渲染完整的 Agent 系统提示词 (System Prompt)
 */
export function renderSystemPrompt(options: SystemPromptRenderOptions): string {
  const { skillManifest, matchedSkills, currentTime } = options;
  const timeStr = currentTime || getCurrentTimeFormatted();
  const skillOverride = renderSkillOverrideDirective(matchedSkills);

  const manifestStr = skillManifest ? `\n${skillManifest}` : '';
  const matchedSkillsStr = matchedSkills ? `\n\n${matchedSkills}` : '';

  return SYSTEM_BASE_PROMPT_TEMPLATE
    .replace('{currentTime}', timeStr)
    .replace('{skillManifest}', manifestStr)
    .replace('{skillOverrideDirective}', skillOverride)
    .replace('{matchedSkills}', matchedSkillsStr);
}
