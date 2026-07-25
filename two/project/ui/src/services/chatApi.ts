// ============================================================
// Chat API Service — raw fetch wrapper & session history APIs
// ============================================================

import type { ChatRequest } from '../types/chat'

const DEFAULT_API = '/api/chat'

export interface ChatApiOptions {
  api?: string
  signal?: AbortSignal
}

/**
 * 获取指定用户的历史会话列表
 */
export async function fetchUserSessions(userId: number = 1) {
  const response = await fetch(`/api/ai/sessions?user_id=${userId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`)
  }
  return await response.json()
}


/**
 * 获取某个会话的全量历史消息
 */
export async function fetchSessionMessages(sessionId: string) {
  const response = await fetch(`/api/ai/sessions/${encodeURIComponent(sessionId)}/messages`)
  if (!response.ok) {
    throw new Error(`Failed to fetch session messages: ${response.statusText}`)
  }
  return await response.json()
}

/**
 * Sends a chat request to the backend and returns the raw Response.
 */
export async function sendChatRequest(
  request: ChatRequest,
  options: ChatApiOptions = {},
): Promise<Response> {
  const { api = DEFAULT_API, signal } = options

  const response = await fetch(api, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/plain, text/event-stream',
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(
      `Chat API error: ${response.status} ${response.statusText} — ${errorText}`,
    )
  }

  return response
}

