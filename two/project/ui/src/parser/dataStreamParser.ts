// ============================================================
// Data Stream Parser — Vercel AI SDK Data Stream Protocol
//
// Protocol reference:
//   0:<json_string>\n  → text delta
//   9:<json_array>\n   → tool call(s)
//   a:<json_array>\n   → tool result(s)
//
// This module is intentionally isolated. Future protocol
// upgrades only touch THIS file — no changes needed elsewhere.
// ============================================================

import type {
  StreamChunk,
  ToolCallPayload,
  ToolResultPayload,
} from '../types/stream'

/**
 * Parses a single line from the Vercel AI Data Stream.
 *
 * @param line - A complete newline-terminated protocol line (without the `\n`)
 * @returns A typed StreamChunk discriminated union
 */
export function parseLine(line: string): StreamChunk {
  if (!line || line.trim() === '') {
    return { type: 'unknown', raw: line }
  }

  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) {
    return { type: 'unknown', raw: line }
  }

  const prefix = line.slice(0, colonIndex)
  const body = line.slice(colonIndex + 1)

  try {
    switch (prefix) {
      case '0': {
        // Text delta — body is a JSON-encoded string
        const content = JSON.parse(body) as string
        if (typeof content !== 'string') {
          return { type: 'error', message: `Expected string for '0:' chunk, got: ${typeof content}` }
        }
        return { type: 'text', content }
      }

      case '9': {
        // Tool call(s) — body is a JSON-encoded array
        const calls = JSON.parse(body) as ToolCallPayload[]
        if (!Array.isArray(calls) || calls.length === 0) {
          return { type: 'unknown', raw: line }
        }
        // Emit the first tool call; caller iterates for multiple
        return { type: 'tool_call', payload: calls[0] }
      }

      case 'a': {
        // Tool result(s) — body is a JSON-encoded array
        const results = JSON.parse(body) as ToolResultPayload[]
        if (!Array.isArray(results) || results.length === 0) {
          return { type: 'unknown', raw: line }
        }
        return { type: 'tool_result', payload: results[0] }
      }

      case 'd': {
        // Stream done signal (some backends emit this)
        return { type: 'done' }
      }

      case '3': {
        // Error signal
        const message = JSON.parse(body) as string
        return { type: 'error', message }
      }

      default:
        return { type: 'unknown', raw: line }
    }
  } catch (e) {
    return {
      type: 'error',
      message: `Failed to parse stream line "${line}": ${String(e)}`,
    }
  }
}

/**
 * Parses multiple tool calls from a single '9:' line.
 * The protocol allows batching multiple tool calls in one array.
 */
export function parseToolCallLine(line: string): ToolCallPayload[] {
  try {
    const body = line.slice(line.indexOf(':') + 1)
    const calls = JSON.parse(body) as ToolCallPayload[]
    return Array.isArray(calls) ? calls : []
  } catch {
    return []
  }
}

/**
 * Parses multiple tool results from a single 'a:' line.
 */
export function parseToolResultLine(line: string): ToolResultPayload[] {
  try {
    const body = line.slice(line.indexOf(':') + 1)
    const results = JSON.parse(body) as ToolResultPayload[]
    return Array.isArray(results) ? results : []
  } catch {
    return []
  }
}
