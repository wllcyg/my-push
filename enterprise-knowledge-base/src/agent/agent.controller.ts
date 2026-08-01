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

      // 纯文本流传输 (适配前端 TextStreamChatTransport)
      for await (const textToken of textStream) {
        if (textToken) {
          res.write(textToken);
        }
      }

      res.end();
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
