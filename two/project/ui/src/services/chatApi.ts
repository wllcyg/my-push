// ============================================================
// Chat API Service — raw fetch wrapper
// Returns the raw Response so callers control streaming.
// ============================================================

import type { ChatRequest } from '../types/chat'

const DEFAULT_API = '/api/chat'

export interface ChatApiOptions {
  api?: string
  signal?: AbortSignal
}

/**
 * Sends a chat request to the backend and returns the raw Response.
 * The caller is responsible for reading the response body as a stream.
 *
 * @throws {Error} When the HTTP status is not OK
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
