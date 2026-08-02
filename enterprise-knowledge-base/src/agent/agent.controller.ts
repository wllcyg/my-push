import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { ChatHistoryService } from './services/chat-history.service';
import { RedisMessageStoreService } from './services/redis-message-store.service';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly redisStoreService: RedisMessageStoreService,
  ) {}

  @Post('chat')
  async chat(
    @Body()
    body: {
      messages?: Array<{ role: string; content: string }>;
      query?: string;
      sessionId?: string;
    },
    @Res() res: any,
  ) {
    try {
      // 兼容两种模式：旧版前端发 messages 数组，新版只需发 { query, sessionId }
      let messages = body.messages || [];
      if (messages.length === 0 && body.query) {
        messages = [{ role: 'user', content: body.query }];
      }

      const { textStream, sessionId } = await this.agentService.streamAgentChat(
        messages,
        body.sessionId,
      );

      // 设置标准 Vercel AI Data Stream / SSE 协议 Response Header 及 Session ID 暴露 Header
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.setHeader('X-Session-Id', sessionId);
      res.setHeader('Access-Control-Expose-Headers', 'X-Session-Id, X-Vercel-AI-Data-Stream');

      // 纯文本流传输 (适配前端 TextStreamChatTransport 与客户端一键中断)
      let clientAborted = false;
      res.on('close', () => {
        if (!res.writableEnded) {
          clientAborted = true;
          this.logger.warn('⚠️ [Agent] 客户端中断了 HTTP 流连接，已停止 Agent 后续响应');
        }
      });

      for await (const textToken of textStream) {
        if (clientAborted) break;
        if (textToken) {
          res.write(textToken);
        }
      }

      if (!clientAborted) {
        res.end();
      }
    } catch (error) {
      this.logger.error('❌ Agent 问答数据流异常:', error.stack);
      if (!res.headersSent) {
        res.status(500).json({ error: (error as Error).message });
      } else {
        res.end();
      }
    }
  }

  /** 获取历史会话列表（来自 Supabase PostgreSQL） */
  @Get('sessions')
  async getSessions() {
    return this.chatHistoryService.getSessions();
  }

  /** 获取指定会话的历史消息明细 */
  @Get('sessions/:id/messages')
  async getSessionMessages(@Param('id') id: string) {
    return this.chatHistoryService.getSessionMessages(id);
  }

  /** 删除指定会话（同时清理 PostgreSQL 和 Redis 缓存） */
  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    await this.redisStoreService.clear(id);
    const success = await this.chatHistoryService.deleteSession(id);
    return { success };
  }
}
