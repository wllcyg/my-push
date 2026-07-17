// ============================================================
// useTheme — Light/Dark theme composable
// ============================================================

import { ref, watchEffect } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'vue-ai-chat-theme'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage not available
  }
  return getSystemTheme()
}

const theme = ref<Theme>(getSavedTheme())

export function useTheme() {
  function setTheme(t: Theme): void {
    theme.value = t
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // ignore
    }
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  // Apply theme attribute to document
  watchEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme.value)
    }
  })

  return {
    theme,
    setTheme,
    toggleTheme,
  }
}
