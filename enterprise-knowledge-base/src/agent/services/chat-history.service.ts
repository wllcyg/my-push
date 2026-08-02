import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSessionEntity } from '../entities/chat-session.entity';
import { ChatMessageEntity } from '../entities/chat-message.entity';

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
  ) {}

  /** 确保会话实体存在，若不存在自动创建（带并发防御） */
  async ensureSession(sessionId: string, initialTitle?: string): Promise<ChatSessionEntity> {
    let session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      try {
        session = this.sessionRepo.create({
          id: sessionId,
          title: initialTitle ? initialTitle.slice(0, 30) : '新对话',
          userId: 1,
          isPinned: false,
          isDeleted: false,
        });
        await this.sessionRepo.save(session);
        this.logger.log(`📝 [ChatHistory] 成功在 Supabase PostgreSQL 创建会话: ${sessionId}`);
      } catch (err) {
        // 如果并发创建冲突，重新查询已存在的会话
        session = (await this.sessionRepo.findOne({ where: { id: sessionId } }))!;
      }
    } else if (initialTitle && session.title === '新对话') {
      session.title = initialTitle.slice(0, 30);
      await this.sessionRepo.save(session).catch(() => {});
    }
    return session;
  }

  /** 保存单条对话消息到 Supabase PostgreSQL */
  async appendMessage(sessionId: string, role: string, content: string): Promise<ChatMessageEntity> {
    await this.ensureSession(sessionId, role === 'user' ? content : undefined);

    const message = this.messageRepo.create({
      id: crypto.randomUUID(),
      sessionId,
      role,
      content,
    });
    const saved = await this.messageRepo.save(message);

    // 更新会话的 updatedAt 字段
    await this.sessionRepo.update(sessionId, { updatedAt: new Date() });
    return saved;
  }

  /** 更新会话摘要与标题（由 Agent 动态摘要触发） */
  async updateSessionSummary(sessionId: string, summary: string): Promise<void> {
    if (!sessionId || !summary) return;
    try {
      await this.sessionRepo.update(sessionId, {
        summary,
        title: summary.slice(0, 30),
        updatedAt: new Date(),
      });
      this.logger.log(`✅ [ChatHistory] 已同步更新 Supabase 中的会话 ${sessionId} 摘要: "${summary.slice(0, 20)}..."`);
    } catch (error) {
      this.logger.error(`❌ [ChatHistory] 更新会话 ${sessionId} 摘要失败: ${(error as Error).message}`);
    }
  }

  /** 获取所有的历史会话列表 */
  async getSessions(limit = 20): Promise<ChatSessionEntity[]> {
    return this.sessionRepo.find({
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  /** 获取指定会话的历史消息明细 */
  async getSessionMessages(sessionId: string): Promise<ChatMessageEntity[]> {
    return this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 删除指定会话及其消息 */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.sessionRepo.delete(sessionId);
    return (result.affected || 0) > 0;
  }
}
