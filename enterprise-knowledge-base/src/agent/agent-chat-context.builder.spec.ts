import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { buildFormattedMessages } from './agent-chat-context.builder';

describe('agent-chat-context.builder', () => {
  it('should format messages correctly with system prompt and user query', () => {
    const messages = buildFormattedMessages({
      userQuery: '你好',
      rawMessages: [{ role: 'user', content: '你好' }],
      redisHistory: [],
      skillManifest: '',
      matchedSkills: '',
    });

    expect(messages.length).toBe(2);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[1].content).toBe('你好');
  });

  it('should inject fewShotMessages after SystemMessage when provided', () => {
    const fewShotMessages = [
      new HumanMessage('示例问'),
      new AIMessage('示例答'),
    ];

    const messages = buildFormattedMessages({
      userQuery: '画个折线图',
      rawMessages: [{ role: 'user', content: '画个折线图' }],
      redisHistory: [],
      skillManifest: '',
      matchedSkills: '',
      fewShotMessages,
    });

    expect(messages.length).toBe(4);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBe(fewShotMessages[0]);
    expect(messages[2]).toBe(fewShotMessages[1]);
    expect(messages[3]).toBeInstanceOf(HumanMessage);
  });
});
