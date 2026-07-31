import { Injectable, Logger } from '@nestjs/common';

export interface ChunkResult {
  chunkIndex: number;
  content: string;
  wordCount: number;
  metadata: Record<string, any>;
}

export interface ChunkingOptions {
  /** 目标分块最大字符数，默认 600 */
  maxChunkSize?: number;
  /** 块与块之间的字符重叠数，默认 100 */
  overlapSize?: number;
}

@Injectable()
export class DocumentChunkingService {
  private readonly logger = new Logger(DocumentChunkingService.name);

  /**
   * 将 Markdown 文本切分为适用于 Vector RAG 的语义切块 (Chunks)
   */
  split(markdown: string, options: ChunkingOptions = {}): ChunkResult[] {
    const maxChunkSize = options.maxChunkSize ?? 600;
    const overlapSize = options.overlapSize ?? 100;

    if (!markdown || !markdown.trim()) {
      return [];
    }

    // 1. 按 Markdown 标题或段落做初步的结构拆分
    const rawSections = this.splitByHeaders(markdown);
    const finalChunks: ChunkResult[] = [];
    let currentIndex = 0;

    for (const section of rawSections) {
      // 2. 如果单个 section 字符数不超过 maxChunkSize，直接作为一个 Chunk
      if (section.content.length <= maxChunkSize) {
        if (section.content.trim()) {
          finalChunks.push({
            chunkIndex: currentIndex++,
            content: section.content.trim(),
            wordCount: this.countWords(section.content),
            metadata: {
              headers: section.headers,
              headerPath: section.headers.join(' > '),
            },
          });
        }
      } else {
        // 3. 超出 maxChunkSize 则基于 Sliding Window 进一步滑动切割，保留 overlap
        const subChunks = this.splitWithSlidingWindow(
          section.content,
          maxChunkSize,
          overlapSize,
        );
        for (const subContent of subChunks) {
          if (subContent.trim()) {
            finalChunks.push({
              chunkIndex: currentIndex++,
              content: subContent.trim(),
              wordCount: this.countWords(subContent),
              metadata: {
                headers: section.headers,
                headerPath: section.headers.join(' > '),
                isSubChunk: true,
              },
            });
          }
        }
      }
    }

    this.logger.log(
      `文档智能切片完成：原始字符数=${markdown.length}, 切片数=${finalChunks.length}`,
    );

    return finalChunks;
  }

  /**
   * 按 Markdown 标题解析层级段落
   */
  private splitByHeaders(
    markdown: string,
  ): Array<{ headers: string[]; content: string }> {
    const lines = markdown.split(/\r?\n/);
    const sections: Array<{ headers: string[]; content: string }> = [];

    let currentHeaders: string[] = [];
    let currentLines: string[] = [];

    const hasNonHeaderContent = (linesArray: string[]): boolean => {
      return linesArray.some(
        (l) => l.trim() && !l.trim().match(/^#{1,6}\s+/),
      );
    };

    const flush = () => {
      const text = currentLines.join('\n').trim();
      if (text) {
        sections.push({
          headers: currentHeaders.filter(Boolean),
          content: text,
        });
      }
      currentLines = [];
    };

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        // 如果当前积累的行中包含真正的非标题正文，才刷新上一段
        if (hasNonHeaderContent(currentLines)) {
          flush();
        }
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();

        // 调整标题层级路径
        currentHeaders = currentHeaders.slice(0, level - 1);
        currentHeaders[level - 1] = title;
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }
    flush();

    return sections.length > 0
      ? sections
      : [{ headers: [], content: markdown }];
  }

  /**
   * 滑动窗口切片算法（带 overlap 重叠区）
   */
  private splitWithSlidingWindow(
    text: string,
    maxChunkSize: number,
    overlapSize: number,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + maxChunkSize;
      if (end >= text.length) {
        chunks.push(text.slice(start));
        break;
      }

      // 尽量找就近的句号/换行符作为切割界限，避免断句
      const boundaryMatch = text
        .slice(start + Math.floor(maxChunkSize * 0.7), end)
        .search(/[\n。！？!?]/);

      if (boundaryMatch !== -1) {
        end = start + Math.floor(maxChunkSize * 0.7) + boundaryMatch + 1;
      }

      chunks.push(text.slice(start, end));

      // 下一次窗口起点计算 (滑动 maxChunkSize - overlapSize)
      const step = Math.max(1, end - start - overlapSize);
      start += step;
    }

    return chunks;
  }

  /**
   * 统计中英混合字数
   */
  private countWords(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const latin = trimmed
      .replace(/[\u4e00-\u9fff]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return cjk + latin;
  }
}
