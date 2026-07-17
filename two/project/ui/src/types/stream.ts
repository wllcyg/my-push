// ============================================================
// Stream Protocol Types — Vercel AI SDK Data Stream Protocol
// Supports: 0: text, 9: tool_call, a: tool_result
// ============================================================

export type StreamChunkType =
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'done'
  | 'error'
  | 'unknown'

export interface TextChunk {
  type: 'text'
  content: string
}

export interface ToolCallPayload {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export interface ToolCallChunk {
  type: 'tool_call'
  payload: ToolCallPayload
}

export interface ToolResultPayload {
  toolCallId: string
  result: unknown
}

export interface ToolResultChunk {
  type: 'tool_result'
  payload: ToolResultPayload
}

export interface DoneChunk {
  type: 'done'
}

export interface ErrorChunk {
  type: 'error'
  message: string
}

export interface UnknownChunk {
  type: 'unknown'
  raw: string
}

/** Discriminated union — exhaustive switch is enforced by TypeScript */
export type StreamChunk =
  | TextChunk
  | ToolCallChunk
  | ToolResultChunk
  | DoneChunk
  | ErrorChunk
  | UnknownChunk
