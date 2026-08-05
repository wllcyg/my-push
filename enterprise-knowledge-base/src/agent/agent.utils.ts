import { BaseMessage } from '@langchain/core/messages';

export const DRAWING_INTENT_REGEX = /[画图表对比趋势占比折线饼图柱状漏斗雷达]/;
export const DIRECT_HARD_RULE_REGEX =
  /^(你好|您好|hi|hello|hey|谢谢|感谢|你是谁|自我介绍|再见|bye|今天几号|今天是几号|分析一下今天是几号|几月几号|几点|当前时间|今天星期几)$/i;
export const SESSION_DEPENDENT_QUERY_REGEX =
  /^(我|你|我们|刚才|上一句|上文|第.*点|修改|删|改|叫什么|我是谁)/i;

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}

export function normalizeUserQuery(query: string): string {
  return String(query || '')
    .trim()
    .replace(/[？?！!。，,呢啊呀吗吧]+$/g, '');
}

export function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (
          item &&
          typeof item === 'object' &&
          'text' in item &&
          typeof (item as { text?: unknown }).text === 'string'
        ) {
          return (item as { text: string }).text;
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  return content == null ? '' : JSON.stringify(content);
}

export function getLastHumanQuery(messages: BaseMessage[]): string {
  const lastHumanMsg = [...messages]
    .reverse()
    .find((m) => m._getType() === 'human');

  return lastHumanMsg ? extractMessageText(lastHumanMsg.content) : '';
}
