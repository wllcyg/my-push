import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  StateGraph,
  START,
  END,
  CompiledStateGraph,
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { Logger } from '@nestjs/common';
import { AgentState, IntentSchema } from './agent.types';
import {
  DIRECT_HARD_RULE_REGEX,
  DRAWING_INTENT_REGEX,
  getLastHumanQuery,
  normalizeUserQuery,
} from './agent.utils';

export interface BuildAgentWorkflowParams {
  mainLlm: ChatOpenAI;
  fastLlm: ChatOpenAI;
  classifierLlm: ChatOpenAI;
  tools: DynamicStructuredTool[];
  logger: Logger;
}

export function buildCompiledAgentWorkflow(
  params: BuildAgentWorkflowParams,
): CompiledStateGraph<any, any, any> {
  const { mainLlm, fastLlm, classifierLlm, tools, logger } = params;
  const llmWithTools = mainLlm.bindTools(tools);
  const fastLlmWithTools = fastLlm.bindTools(tools);

  const intentNode = async (
    state: typeof AgentState.State,
    config?: RunnableConfig,
  ) => {
    const userQuery = getLastHumanQuery(state.messages);
    const normalizedQuery = normalizeUserQuery(userQuery);

    if (DRAWING_INTENT_REGEX.test(normalizedQuery)) {
      logger.log('🎯 [IntentRouter] 触发绘图硬规则 => 强制走向 RAG/技能分支');
      return { intent: 'RAG' as const };
    }

    if (DIRECT_HARD_RULE_REGEX.test(normalizedQuery)) {
      logger.log('🎯 [IntentRouter] 触发硬规则匹配 => DIRECT (免去 LLM 分类)');
      return { intent: 'DIRECT' as const };
    }

    try {
      const structuredClassifier = classifierLlm.withStructuredOutput(
        IntentSchema,
        {
          name: 'route_intent',
        },
      );

      const result = await structuredClassifier.invoke(
        [
          new SystemMessage(
            '你是一个专业的企业 AI 助手意图路由分类器。分析用户问题，判定是否需要检索知识库或使用专业技能。若涉及画图、图表或数据展示，必须选择 RAG。',
          ),
          new HumanMessage(userQuery || '你好'),
        ],
        config,
      );

      logger.log(
        `🎯 [IntentRouter] 识别完成 => 意图: ${result.intent}, 原因: ${result.reason || '无'}`,
      );
      return { intent: result.intent };
    } catch (error) {
      logger.warn(
        `⚠️ [IntentRouter] 意图分类异常，降级默认走 RAG 分支: ${(error as Error).message}`,
      );
      return { intent: 'RAG' as const };
    }
  };

  const callRagNode = async (
    state: typeof AgentState.State,
    config?: RunnableConfig,
  ) => {
    const userQuery = getLastHumanQuery(state.messages);
    const isDrawingHit = DRAWING_INTENT_REGEX.test(userQuery);

    const targetLlm = isDrawingHit ? fastLlmWithTools : llmWithTools;
    if (isDrawingHit) {
      logger.log(
        '⚡ [AgentService] 触发绘图需求，切换为极速模型 (qwen-turbo) 极速推理...',
      );
    }

    const response = await targetLlm.invoke(state.messages, config);
    if (response && response.tool_calls && response.tool_calls.length > 0) {
      for (const tc of response.tool_calls) {
        logger.log(
          `🤖 [LangGraph] Agent 决策触发 Tool: ${tc.name}, 参数: ${JSON.stringify(tc.args)}`,
        );
      }
    }
    return { messages: [response] };
  };

  const callDirectNode = async (
    state: typeof AgentState.State,
    config?: RunnableConfig,
  ) => {
    const userQuery = getLastHumanQuery(state.messages);
    const isDrawingHit = DRAWING_INTENT_REGEX.test(userQuery);
    const targetLlm = isDrawingHit ? fastLlm : mainLlm;

    const response = await targetLlm.invoke(state.messages, config);
    return { messages: [response] };
  };

  const toolsNode = new ToolNode(tools);

  const workflow = new StateGraph(AgentState)
    .addNode('intent_router', intentNode)
    .addNode('rag_agent', callRagNode)
    .addNode('direct_agent', callDirectNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'intent_router')
    .addConditionalEdges('intent_router', (state) => state.intent, {
      RAG: 'rag_agent',
      DIRECT: 'direct_agent',
    })
    .addConditionalEdges('rag_agent', toolsCondition, {
      tools: 'tools',
      __end__: END,
    })
    .addEdge('tools', 'rag_agent')
    .addEdge('direct_agent', END);

  return workflow.compile();
}
