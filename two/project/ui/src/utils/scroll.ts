// ============================================================
// Scroll Controller Utility
// Manages auto-scroll behavior with user override detection
// ============================================================

export interface ScrollController {
  /** Call this when a new message chunk arrives */
  onContentUpdate: () => void
  /** Call this to force scroll to bottom (e.g. on new user message) */
  scrollToBottom: () => void
  /** Attach to a scroll container element */
  attach: (el: HTMLElement) => void
  /** Detach listeners */
  detach: () => void
  /** True when user has manually scrolled up */
  isUserScrolled: boolean
}

/**
 * Creates a scroll controller that auto-scrolls to the bottom during
 * streaming, but pauses when the user manually scrolls up.
 *
 * Resume auto-scroll when the user scrolls back to near the bottom.
 */
export function createScrollController(): ScrollController {
  let containerEl: HTMLElement | null = null
  let isUserScrolled = false
  let scrollListenerCleanup: (() => void) | null = null

  const BOTTOM_THRESHOLD = 80 // px from bottom to consider "at bottom"

  function isNearBottom(): boolean {
    if (!containerEl) return false
    const { scrollTop, scrollHeight, clientHeight } = containerEl
    return scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD
  }

  function scrollToBottom(): void {
    if (!containerEl) return
    containerEl.scrollTop = containerEl.scrollHeight
    isUserScrolled = false
  }

  function onScroll(): void {
    if (!containerEl) return
    if (isNearBottom()) {
      isUserScrolled = false
    } else {
      isUserScrolled = true
    }
  }

  function onContentUpdate(): void {
    if (!isUserScrolled) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }

  function attach(el: HTMLElement): void {
    if (containerEl && scrollListenerCleanup) {
      scrollListenerCleanup()
    }
    containerEl = el
    el.addEventListener('scroll', onScroll, { passive: true })
    scrollListenerCleanup = () => el.removeEventListener('scroll', onScroll)
  }

  function detach(): void {
    scrollListenerCleanup?.()
    scrollListenerCleanup = null
    containerEl = null
    isUserScrolled = false
  }

  return {
    get isUserScrolled() { return isUserScrolled },
    onContentUpdate,
    scrollToBottom,
    attach,
    detach,
  }
}
