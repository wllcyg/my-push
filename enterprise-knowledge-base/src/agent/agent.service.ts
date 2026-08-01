import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { createKnowledgeRetrieverTool } from './tools/knowledge-retriever.tool';
import { EmbeddingService } from '../document/services/embedding.service';
import { LlmService } from '../llm/llm.service';

/** 定义 LangGraph Agent 对话状态结构 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

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
   * 智能 Agent 问答流 (基于 LangGraph StateGraph 状态图引擎驱动)
   */
  async *streamAgentChat(rawMessages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
    this.logger.log(`🚀 [LangGraph] 收到问答请求，历史对话轮数: ${rawMessages.length}`);

    // 1. 转换格式化初始消息
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
      if (!msg) continue;

      let textContent = '';
      if (typeof msg.content === 'string') {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = (msg.content as any[])
          .filter((c: any) => c && (c.type === 'text' || typeof c === 'string'))
          .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
          .join('');
      } else if (Array.isArray((msg as any).parts)) {
        textContent = ((msg as any).parts as any[])
          .filter((p: any) => p && (p.type === 'text' || typeof p === 'string'))
          .map((p: any) => (typeof p === 'string' ? p : p.text || ''))
          .join('');
      }

      if (!textContent) continue;

      if (msg.role === 'user') {
        formattedMessages.push(new HumanMessage(textContent));
      } else if (msg.role === 'assistant') {
        formattedMessages.push(new AIMessage(textContent));
      }
    }

    // 2. 创建向量检索工具与 Tool 节点
    const retrieverTool = createKnowledgeRetrieverTool(
      this.embeddingService,
      this.dataSource,
    );
    const llmWithTools = this.llm.bindTools([retrieverTool]);

    // 定义 Agent 思考决策节点
    const callModelNode = async (state: typeof AgentState.State) => {
      const response = await llmWithTools.invoke(state.messages);
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          this.logger.log(
            `🤖 [LangGraph ToolCall] 触发工具: ${tc.name}, 参数: ${JSON.stringify(tc.args)}`,
          );
        }
      }
      return { messages: [response] };
    };

    // 定义 Tools 自动执行节点
    const toolsNode = new ToolNode([retrieverTool]);

    // 3. 构建 LangGraph 状态图结构 (START -> agent -> (toolsCondition) -> tools -> agent -> END)
    const workflow = new StateGraph(AgentState)
      .addNode('agent', callModelNode)
      .addNode('tools', toolsNode)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', toolsCondition, {
        tools: 'tools',
        __end__: END,
      })
      .addEdge('tools', 'agent');

    const app = workflow.compile();

    // 4. 运行状态图，流式捕获生成的内容
    const stream = await app.stream(
      { messages: formattedMessages },
      { streamMode: 'messages' },
    );

    for await (const [message, meta] of stream) {
      // 仅提取 agent 节点发出的文本消息
      if (meta?.langgraph_node === 'agent' && message && typeof message.content === 'string') {
        if (message.content) {
          yield message.content;
        }
      }
    }
  }
}
