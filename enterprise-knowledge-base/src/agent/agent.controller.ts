import { Controller, Post, Body, Res, Logger } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(
    @Body() body: { messages: Array<{ role: string; content: string }> },
    @Res() res: any,
  ) {
    try {
      const messages = body.messages || [];
      const textStream = await this.agentService.streamAgentChat(messages);

      // 设置标准 Vercel AI Data Stream / SSE 协议 Response Header
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

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
        res.status(500).json({ error: error.message });
      } else {
        res.end();
      }
    }
  }
}
