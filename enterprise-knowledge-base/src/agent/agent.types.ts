import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';

export const IntentSchema = z.object({
  intent: z
    .enum(['RAG', 'DIRECT'])
    .describe(
      'RAG: 当用户询问具体技术细节、企业业务流程、文档规范、简历或产品内容时选择;\n' +
        'DIRECT: 当用户仅为日常打招呼(你好/Hi)、表示感谢、询问助手是谁、询问当前时间/日期、要求写通用无关代码或闲聊时选择。',
    ),
  reason: z.string().optional().describe('分类原因简述'),
});

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  intent: Annotation<'RAG' | 'DIRECT'>({
    reducer: (x, y) => y ?? x,
    default: () => 'RAG',
  }),
});
