// ============================================================
// Core Chat Types — zero `any`, strict discriminated unions
// ============================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error'

// ── Tool Layer ──────────────────────────────────────────────

export interface ToolInvocation {
  /** Unique identifier matching the result's toolCallId */
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  /** ISO timestamp when the invocation was received */
  startedAt: string
}

export interface ToolResult {
  toolCallId: string
  /** Raw result from backend — could be string, object, or array */
  result: unknown
  /** ISO timestamp when the result was received */
  completedAt: string
  /** Duration in milliseconds */
  durationMs: number
}

// ── Message Layer ───────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  /** Ordered list of tool invocations within this message */
  toolInvocations: ToolInvocation[]
  /** Map from toolCallId → ToolResult */
  toolResults: Map<string, ToolResult>
  createdAt: string
  /** True while streaming is still in progress for this message */
  isStreaming: boolean
}

// ── Request / Response ──────────────────────────────────────

export interface ChatRequestMessage {
  role: MessageRole
  content: string
}

export interface ChatRequest {
  messages: ChatRequestMessage[]
}

// ── useChat Options ─────────────────────────────────────────

export interface UseChatOptions {
  /** API endpoint — defaults to '/api/chat' */
  api?: string
  /** Initial messages to pre-populate the chat */
  initialMessages?: ChatMessage[]
  /** Called on every completed assistant response */
  onFinish?: (message: ChatMessage) => void
  /** Called when a stream error occurs */
  onError?: (error: Error) => void
}
