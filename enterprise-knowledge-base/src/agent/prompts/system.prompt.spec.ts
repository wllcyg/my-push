import {
  renderSystemPrompt,
  renderSkillOverrideDirective,
  SKILL_OVERRIDE_PROMPT_TEMPLATE,
} from './system.prompt';

describe('SystemPrompt Module', () => {
  it('should render basic system prompt with default values', () => {
    const prompt = renderSystemPrompt({
      currentTime: '2026-08-05 12:00:00',
    });

    expect(prompt).toContain('当前系统时间：2026-08-05 12:00:00');
    expect(prompt).toContain('knowledge_retriever');
    expect(prompt).not.toContain('🚨🚨🚨【最高优先级强指令');
  });

  it('should include skill manifest and matched skills directive when matchedSkills exists', () => {
    const matchedSkills = '<!-- Skill: echarts-visualization -->';
    const skillManifest = '- 【技能: echarts-visualization】: 生成动态图表';

    const prompt = renderSystemPrompt({
      currentTime: '2026-08-05 12:00:00',
      skillManifest,
      matchedSkills,
    });

    expect(prompt).toContain(skillManifest);
    expect(prompt).toContain(SKILL_OVERRIDE_PROMPT_TEMPLATE);
    expect(prompt).toContain(matchedSkills);
  });

  it('should render empty override directive if matchedSkills is empty', () => {
    expect(renderSkillOverrideDirective('')).toBe('');
    expect(renderSkillOverrideDirective(undefined)).toBe('');
  });
});
