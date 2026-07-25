import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import { uid } from '../utils/uid'
import { sendChatRequest, fetchSessionMessages } from '../services/chatApi'
import { parseLine, parseToolCallLine, parseToolResultLine } from '../parser/dataStreamParser'
import type {
  ChatMessage,
  ChatStatus,
  UseChatOptions,
  ChatRequestMessage,
} from '../types/chat'

export interface ExtendedUseChatOptions extends UseChatOptions {
  getSessionId?: () => string | null
  setSessionId?: (id: string) => void
  getUserId?: () => number
  onSessionCreated?: (sessionId: string) => void
}

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
  loadSessionMessages: (sessionId: string) => Promise<void>
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

export function useChat(options: ExtendedUseChatOptions = {}): UseChatReturn {
  const { 
    api = '/api/ai/chat/stream', 
    initialMessages = [], 
    onFinish, 
    onError,
    getSessionId,
    setSessionId,
    getUserId,
    onSessionCreated
  } = options

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

  /**
   * 按 session_id 从后端全量加载历史消息明细
   */
  async function loadSessionMessages(sessionId: string) {
    if (!sessionId) {
      messages.value = []
      return
    }
    status.value = 'submitted'
    try {
      const res = await fetchSessionMessages(sessionId)
      if (res.status === 'success' && Array.isArray(res.data)) {
        messages.value = res.data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolInvocations: [],
          toolResults: new Map(),
          createdAt: m.created_at || new Date().toISOString(),
          isStreaming: false
        }))
      }
    } catch (err) {
      console.error('[loadSessionMessages Error]', err)
    } finally {
      status.value = 'idle'
    }
  }

  // ── Core streaming logic ─────────────────────────────────────

  async function streamResponse(assistantMsgId: string, lastUserPrompt: string): Promise<void> {
    const assistantMsg = messages.value.find(m => m.id === assistantMsgId)
    if (!assistantMsg) return

    abortController = new AbortController()
    status.value = 'streaming'

    try {
      const currentSessionId = getSessionId?.() ?? ''
      const currentUserId = getUserId?.() ?? 1
      let response: Response

      // 支持基于 GET SSE 的后端协议
      if (api.includes('/ai/chat/stream') || api.includes('/chat/stream')) {
        const url = `${api}?prompt=${encodeURIComponent(lastUserPrompt)}&user_id=${currentUserId}${currentSessionId ? `&session_id=${currentSessionId}` : ''}`
        response = await fetch(url, { signal: abortController.signal })
      } else {
        response = await sendChatRequest(
          { messages: buildRequestMessages() },
          { api, signal: abortController.signal },
        )
      }

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status} ${response.statusText}`)
      }

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

          // 处理 SSE 产生的 "data: {"text": "...", "session_id": "..."}" 格式
          if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim()
            if (rawData === '[DONE]') continue

            try {
              const parsed = JSON.parse(rawData)
              if (parsed.text) {
                assistantMsg.content += parsed.text
              }
              if (parsed.session_id && setSessionId) {
                setSessionId(parsed.session_id)
                onSessionCreated?.(parsed.session_id)
              }
              continue
            } catch (e) {
              // 降级为直接文本处理
            }
          }

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
          if (chunk.type === 'text') {
            assistantMsg.content += chunk.content
          }
        }
      }

      assistantMsg.isStreaming = false
      status.value = 'idle'
      onFinish?.(assistantMsg)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
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

    // Push empty assistant message
    const assistantMsg = createMessage('assistant', '', true)
    messages.value.push(assistantMsg)

    await streamResponse(assistantMsg.id, content)
  }

  function stop(): void {
    abortController?.abort()
    abortController = null

    const streaming = messages.value.find(m => m.isStreaming)
    if (streaming) streaming.isStreaming = false
    status.value = 'idle'
  }

  async function reload(): Promise<void> {
    if (loading.value) return

    let lastUserPrompt = ''
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'user') {
        lastUserPrompt = messages.value[i].content
        break
      }
    }

    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'assistant') {
        messages.value.splice(i, 1)
        break
      }
    }

    const assistantMsg = createMessage('assistant', '', true)
    messages.value.push(assistantMsg)
    status.value = 'submitted'

    await streamResponse(assistantMsg.id, lastUserPrompt)
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
    loadSessionMessages,
    appendMessage,
    removeMessage,
  }
}

