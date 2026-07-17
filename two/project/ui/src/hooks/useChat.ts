// ============================================================
// useChat — Core Chat Composable
//
// Manages the full lifecycle of a streaming AI chat session:
//   - Message state
//   - Fetch + streaming via ReadableStream
//   - AbortController for stop()
//   - Tool invocation tracking
//   - Auto-scroll integration
//
// Does NOT contain any protocol parsing logic.
// Delegates to parseLine() from dataStreamParser.ts
// ============================================================

import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import { uid } from '../utils/uid'
import { sendChatRequest } from '../services/chatApi'
import { parseLine, parseToolCallLine, parseToolResultLine } from '../parser/dataStreamParser'
import type {
  ChatMessage,
  ChatStatus,
  UseChatOptions,
  ChatRequestMessage,
} from '../types/chat'

export interface UseChatReturn {
  // State
  messages: Readonly<Ref<ChatMessage[]>>
  input: Ref<string>
  status: Readonly<Ref<ChatStatus>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<Error | null>>

  // Actions
  send: (text?: string) => Promise<void>
  stop: () => void
  reload: () => Promise<void>
  clear: () => void
  appendMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => ChatMessage
  removeMessage: (id: string) => void
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  isStreaming = false,
): ChatMessage {
  return {
    id: uid(),
    role,
    content,
    toolInvocations: [],
    toolResults: new Map(),
    createdAt: new Date().toISOString(),
    isStreaming,
  }
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { api = '/api/chat', initialMessages = [], onFinish, onError } = options

  // ── State ───────────────────────────────────────────────────
  const messages = ref<ChatMessage[]>(initialMessages.map(m => ({ ...m })))
  const input = ref<string>('')
  const status = ref<ChatStatus>('idle')
  const error = ref<Error | null>(null)
  let abortController: AbortController | null = null

  const loading = computed(
    () => status.value === 'submitted' || status.value === 'streaming',
  )

  function buildRequestMessages(): ChatRequestMessage[] {
    return messages.value
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  }


  // ── Core streaming logic ─────────────────────────────────────

  async function streamResponse(assistantMsgId: string): Promise<void> {
    const assistantMsg = messages.value.find(m => m.id === assistantMsgId)
    if (!assistantMsg) return

    abortController = new AbortController()
    status.value = 'streaming'

    try {
      const response = await sendChatRequest(
        { messages: buildRequestMessages() },
        { api, signal: abortController.signal },
      )

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Response body is not readable')

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue

          // Handle multiple tool calls in a single '9:' line
          if (line.startsWith('9:')) {
            const calls = parseToolCallLine(line)
            for (const call of calls) {
              assistantMsg.toolInvocations.push({
                toolCallId: call.toolCallId,
                toolName: call.toolName,
                args: call.args,
                startedAt: new Date().toISOString(),
              })
            }
            continue
          }

          // Handle multiple tool results in a single 'a:' line
          if (line.startsWith('a:')) {
            const results = parseToolResultLine(line)
            for (const r of results) {
              const invocation = assistantMsg.toolInvocations.find(
                t => t.toolCallId === r.toolCallId,
              )
              const startedAt = invocation?.startedAt ?? new Date().toISOString()
              const completedAt = new Date().toISOString()
              const durationMs =
                new Date(completedAt).getTime() - new Date(startedAt).getTime()

              assistantMsg.toolResults.set(r.toolCallId, {
                toolCallId: r.toolCallId,
                result: r.result,
                completedAt,
                durationMs,
              })
            }
            continue
          }

          const chunk = parseLine(line)

          switch (chunk.type) {
            case 'text':
              assistantMsg.content += chunk.content
              break

            case 'done':
              break

            case 'error':
              throw new Error(chunk.message)

            case 'unknown':
            default:
              // Silently ignore unknown protocol lines
              break
          }
        }
      }

      // Drain any remaining buffer
      if (buffer.trim()) {
        const chunk = parseLine(buffer)
        if (chunk.type === 'text') {
          assistantMsg.content += chunk.content
        }
      }

      assistantMsg.isStreaming = false
      status.value = 'idle'
      onFinish?.(assistantMsg)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped the stream — graceful exit
        if (assistantMsg) assistantMsg.isStreaming = false
        status.value = 'idle'
        return
      }

      const e = err instanceof Error ? err : new Error(String(err))
      error.value = e
      if (assistantMsg) assistantMsg.isStreaming = false
      status.value = 'error'
      onError?.(e)
    } finally {
      abortController = null
    }
  }

  // ── Public Actions ───────────────────────────────────────────

  async function send(text?: string): Promise<void> {
    const content = (text ?? input.value).trim()
    if (!content || loading.value) return

    error.value = null
    input.value = ''

    // Push user message
    messages.value.push(createMessage('user', content))
    status.value = 'submitted'

    // Push empty assistant message (will be filled by stream)
    const assistantMsg = createMessage('assistant', '', true)
    messages.value.push(assistantMsg)

    await streamResponse(assistantMsg.id)
  }

  function stop(): void {
    abortController?.abort()
    abortController = null

    // Mark any streaming message as done
    const streaming = messages.value.find(m => m.isStreaming)
    if (streaming) streaming.isStreaming = false
    status.value = 'idle'
  }

  async function reload(): Promise<void> {
    if (loading.value) return

    // Find the last assistant message and remove it, then resend
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'assistant') {
        messages.value.splice(i, 1)
        break
      }
    }

    // Re-push an empty assistant message and stream again
    const assistantMsg = createMessage('assistant', '', true)
    messages.value.push(assistantMsg)
    status.value = 'submitted'

    await streamResponse(assistantMsg.id)
  }

  function clear(): void {
    stop()
    messages.value = []
    input.value = ''
    error.value = null
    status.value = 'idle'
  }

  function appendMessage(
    partial: Omit<ChatMessage, 'id' | 'createdAt'>,
  ): ChatMessage {
    const msg: ChatMessage = {
      ...partial,
      id: uid(),
      createdAt: new Date().toISOString(),
    }
    messages.value.push(msg)
    return msg
  }

  function removeMessage(id: string): void {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx !== -1) messages.value.splice(idx, 1)
  }

  return {
    messages: readonly(messages) as Readonly<Ref<ChatMessage[]>>,
    input,
    status: readonly(status),
    loading: readonly(loading),
    error: readonly(error),
    send,
    stop,
    reload,
    clear,
    appendMessage,
    removeMessage,
  }
}
