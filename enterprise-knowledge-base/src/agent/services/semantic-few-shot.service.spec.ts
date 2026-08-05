import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { SemanticFewShotService } from './semantic-few-shot.service';

describe('SemanticFewShotService', () => {
  let service: SemanticFewShotService;

  beforeEach(() => {
    service = new SemanticFewShotService();
  });

  it('should find matched example for drawing request', () => {
    const matched = service.findMatchedExamples('请给我画一个季度销售额柱状图');
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe('echarts_bar_chart');
  });

  it('should find matched example for trend line chart request', () => {
    const matched = service.findMatchedExamples('分析一下最近用户变化趋势图');
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe('echarts_line_chart');
  });

  it('should find matched example for knowledge rag citation', () => {
    const matched = service.findMatchedExamples('知识库中员工差旅报销制度是怎样的？');
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe('knowledge_rag_citation');
  });

  it('should return empty list when no keywords/scenario matched', () => {
    const matched = service.findMatchedExamples('今天天气怎么样');
    expect(matched.length).toBe(0);
  });

  it('should build HumanMessage and AIMessage pairs correctly', () => {
    const messages = service.buildFewShotMessages('对比四个季度销量画个图', 1);
    expect(messages.length).toBe(2);
    expect(messages[0]).toBeInstanceOf(HumanMessage);
    expect(messages[1]).toBeInstanceOf(AIMessage);
    expect(messages[1].content).toContain('```json:echarts');
  });
});
