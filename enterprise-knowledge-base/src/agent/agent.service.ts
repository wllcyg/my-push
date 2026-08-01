import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
import { createKnowledgeRetrieverTool } from './tools/knowledge-retriever.tool';
import { EmbeddingService } from '../document/services/embedding.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private llm: ChatOpenAI;

  constructor(
    private readonly llmService: LlmService,
    private readonly embeddingService: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {
    this.llm = this.llmService.createChatModel({
      temperature: 0.2,
      streaming: true,
    });
  }

  /**
   * 智能 Agent 问答流 (支持 ToolCall 自动循环与结果回传)
   */
  async *streamAgentChat(rawMessages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
    this.logger.log(`🚀 收到新的 Agent 问答请求，对话轮数: ${rawMessages.length}`);

    // 1. 转换历史消息格式
    const formattedMessages: BaseMessage[] = [
      new SystemMessage(
        '你是一个专业、严谨的企业知识库 AI 智能助手。你的目标是帮助用户回答技术、业务、文档及员工相关问题。\n' +
        '规则：\n' +
        '1. 当用户的问题涉及具体技术、文档规范、简历或业务内容时，你必须且优先调用 `knowledge_retriever` 工具在知识库中进行向量检索。\n' +
        '2. 如果检索到了相关知识切片，请基于切片内容准确作答，并在回答中以 `[1]`、`[2]` 角标标注出处。\n' +
        '3. 若未找到相关信息，请诚实告知用户，不要胡乱编造。',
      ),
    ];

    for (const msg of rawMessages) {
      if (msg.role === 'user') {
        formattedMessages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        formattedMessages.push(new AIMessage(msg.content));
      }
    }

    // 2. 绑定向量检索工具
    const retrieverTool = createKnowledgeRetrieverTool(
      this.embeddingService,
      this.dataSource,
    );
    const llmWithTools = this.llm.bindTools([retrieverTool]);

    // 3. 第一轮模型调用：判定是否需要触发 Tool
    const responseMsg = await llmWithTools.invoke(formattedMessages);

    // 4. 检查是否包含了 ToolCall
    if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
      formattedMessages.push(responseMsg);

      for (const toolCall of responseMsg.tool_calls) {
        this.logger.log(
          `🤖 [Agent ToolCall] 自动触发工具: ${toolCall.name}, 参数: ${JSON.stringify(toolCall.args)}`,
        );

        let toolResult = '';
        if (toolCall.name === 'knowledge_retriever') {
          const rawToolRes = await retrieverTool.invoke(toolCall.args as any);
          toolResult = typeof rawToolRes === 'string' ? rawToolRes : JSON.stringify(rawToolRes);
        } else {
          toolResult = '未知的工具调用';
        }

        // 回传 Tool 执行结果
        formattedMessages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id || 'tool_call_0',
          }),
        );
      }

      // 5. 带上 Tool 检索到的上下文，进行第二轮流式作答
      const finalStream = await this.llm.stream(formattedMessages);
      for await (const chunk of finalStream) {
        if (typeof chunk.content === 'string' && chunk.content) {
          yield chunk.content;
        }
      }
    } else {
      // 未触发 ToolCall，直接输出第一轮响应文本
      if (typeof responseMsg.content === 'string' && responseMsg.content) {
        yield responseMsg.content;
      }
    }
  }
}

