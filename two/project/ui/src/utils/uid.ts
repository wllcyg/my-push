// ============================================================
// ID Generator — nanoid wrapper
// ============================================================

import { nanoid } from 'nanoid'

/** Generates a collision-resistant 21-char ID */
export function uid(): string {
  return nanoid()
}

/** Generates a shorter 10-char ID for display purposes */
export function shortId(): string {
  return nanoid(10)
}
