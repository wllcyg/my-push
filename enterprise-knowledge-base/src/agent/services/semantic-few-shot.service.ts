import { Injectable, Logger } from '@nestjs/common';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  FewShotExample,
  PRESET_FEW_SHOT_EXAMPLES,
} from '../prompts/few-shot-examples';

@Injectable()
export class SemanticFewShotService {
  private readonly logger = new Logger(SemanticFewShotService.name);
  private examples: FewShotExample[] = [...PRESET_FEW_SHOT_EXAMPLES];

  /**
   * 根据用户提问，计算语义重叠度与关键词匹配得分，检索最契合的 Few-Shot 示范
   */
  public findMatchedExamples(
    userQuery: string,
    limit: number = 1,
  ): FewShotExample[] {
    if (!userQuery || !userQuery.trim() || this.examples.length === 0) {
      return [];
    }

    const query = userQuery.toLowerCase().trim();

    const scored = this.examples.map((example) => {
      let score = 0;

      // 1. 关键词命中得分 (权重较高)
      for (const kw of example.keywords) {
        if (query.includes(kw.toLowerCase())) {
          score += 3.0;
        }
      }

      // 2. 场景定义重叠得分
      const scenarioTokens = example.scenario.toLowerCase().split('');
      for (const char of scenarioTokens) {
        if (char.trim() && query.includes(char)) {
          score += 0.05;
        }
      }

      // 3. 用户问题文本与示例 Query 的相似度 Jaccard 粗测
      const queryCharSet = new Set(query);
      const exampleQuerySet = new Set(example.userQuery.toLowerCase());
      let intersectionCount = 0;
      queryCharSet.forEach((char) => {
        if (exampleQuerySet.has(char)) intersectionCount++;
      });

      const unionSize = new Set([...queryCharSet, ...exampleQuerySet]).size;
      if (unionSize > 0) {
        const jaccardScore = intersectionCount / unionSize;
        score += jaccardScore * 2.0;
      }

      return { example, score };
    });

    // 按得分倒序排序
    scored.sort((a, b) => b.score - a.score);

    // 设置最小相似度阈值，只有超过得分阈值的范例才会被挑选
    const threshold = 1.2;
    const matched = scored
      .filter((item) => item.score >= threshold)
      .slice(0, limit)
      .map((item) => item.example);

    if (matched.length > 0) {
      this.logger.log(
        `🎯 [SemanticFewShot] 为提问 "${userQuery.slice(0, 20)}..." 匹配到 ${matched.length} 个少样本示范: ${matched.map((m) => m.id).join(', ')}`,
      );
    }

    return matched;
  }

  /**
   * 将检索命中的 Few-Shot 范例转换为 LangChain 规范的 [HumanMessage, AIMessage] 消息序列
   */
  public buildFewShotMessages(
    userQuery: string,
    limit: number = 1,
  ): BaseMessage[] {
    const matched = this.findMatchedExamples(userQuery, limit);
    if (matched.length === 0) return [];

    const messages: BaseMessage[] = [];
    for (const example of matched) {
      messages.push(new HumanMessage(example.userQuery));
      messages.push(new AIMessage(example.assistantOutput));
    }
    return messages;
  }

  /**
   * 注册自定义 Few-Shot 示范
   */
  public registerExample(example: FewShotExample): void {
    this.examples.push(example);
    this.logger.log(`📌 [SemanticFewShot] 动态注册少样本示范: ${example.id}`);
  }
}
