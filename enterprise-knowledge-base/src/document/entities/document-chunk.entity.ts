import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  ValueTransformer,
} from 'typeorm';
import { bigintTransformer } from '../../common/transformers/bigint.transformer';

/**
 * pgvector 向量数组 Transformer
 * 将 JS number[] 转换为 pgvector 的 '[0.1,0.2,...]' 格式
 */
export const vectorTransformer: ValueTransformer = {
  to(value: number[] | null): string | null {
    if (!value || !Array.isArray(value)) return null;
    return `[${value.join(',')}]`;
  },
  from(value: string | number[] | null): number[] | null {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const cleaned = value.replace(/^\[|\]$/g, '');
        if (!cleaned.trim()) return [];
        return cleaned.split(',').map(Number);
      } catch {
        return null;
      }
    }
    return null;
  },
};

/** 文档分块与向量存储实体（PostgreSQL kh_document_chunk） */
@Entity('kh_document_chunk')
export class DocumentChunkEntity {
  /** 雪花 ID */
  @PrimaryColumn({ type: 'bigint', transformer: bigintTransformer })
  id!: string;

  /** 关联文档 ID */
  @Column({
    name: 'document_id',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  documentId!: string;

  /** 切片序号 (0-indexed) */
  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  /** 切片文本正文 */
  @Column({ type: 'text' })
  content!: string;

  /** 切片文本字数 */
  @Column({ name: 'word_count', type: 'int', default: 0 })
  wordCount!: number;

  /** 向量数据 (适配 pgvector 类型或矢量字符串) */
  @Column({
    type: 'text',
    nullable: true,
    transformer: vectorTransformer,
  })
  embedding?: number[] | null;

  /** 扩展元数据 (如结构层级路径、所在标题等) */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
