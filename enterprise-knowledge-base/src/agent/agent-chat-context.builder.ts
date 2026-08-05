import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { renderSystemPrompt } from './prompts/system.prompt';

export interface BuildAgentContextOptions {
  userQuery: string;
  rawMessages: Array<{ role: string; content: string }>;
  redisHistory: BaseMessage[];
  skillManifest: string;
  matchedSkills: string;
  fewShotMessages?: BaseMessage[];
}

export function buildFormattedMessages(
  options: BuildAgentContextOptions,
): BaseMessage[] {
  const {
    userQuery,
    rawMessages,
    redisHistory,
    skillManifest,
    matchedSkills,
    fewShotMessages = [],
  } = options;

  const systemPromptContent = renderSystemPrompt({
    skillManifest,
    matchedSkills,
  });

  const formattedMessages: BaseMessage[] = [
    new SystemMessage(systemPromptContent),
  ];

  // 注入 Semantic Few-Shot 示例消息对（插入于 System Prompt 之后，引导模型格式规范）
  if (fewShotMessages && fewShotMessages.length > 0) {
    formattedMessages.push(...fewShotMessages);
  }

  if (rawMessages.length > 1) {
    for (const msg of rawMessages) {
      if (!msg) continue;
      const textContent =
        typeof msg.content === 'string'
          ? msg.content
          : String(msg.content || '');
      if (!textContent) continue;
      if (msg.role === 'user') {
        formattedMessages.push(new HumanMessage(textContent));
      } else if (msg.role === 'assistant') {
        formattedMessages.push(new AIMessage(textContent));
      }
    }
    return formattedMessages;
  }

  if (redisHistory.length > 0) {
    formattedMessages.push(...redisHistory);
    formattedMessages.push(new HumanMessage(userQuery));
    return formattedMessages;
  }

  formattedMessages.push(new HumanMessage(userQuery));
  return formattedMessages;
}
