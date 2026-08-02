import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatSessionEntity } from './chat-session.entity';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', length: 32 })
  role: string; // 'user' | 'assistant' | 'system'

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date = new Date();

  @ManyToOne(() => ChatSessionEntity, (session) => session.messages, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'session_id' })
  session: ChatSessionEntity;
}
