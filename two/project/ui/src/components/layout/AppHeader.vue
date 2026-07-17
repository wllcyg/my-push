<script setup lang="ts">
import { useTheme } from '../../hooks/useTheme'
import { useChatStore } from '../../stores/chatStore'

const { theme, toggleTheme } = useTheme()
const chatStore = useChatStore()

defineEmits<{
  newChat: []
  toggleSidebar: []
}>()
</script>

<template>
  <header class="app-header">
    <!-- Left: sidebar toggle -->
    <div class="app-header__left">
      <button
        class="app-header__icon-btn"
        :aria-label="chatStore.isSidebarOpen ? 'Close sidebar' : 'Open sidebar'"
        :title="chatStore.isSidebarOpen ? 'Close sidebar' : 'Open sidebar'"
        @click="$emit('toggleSidebar')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
    </div>

    <!-- Center: brand -->
    <div class="app-header__center">
      <div class="app-header__brand">
        <span class="app-header__brand-dot" aria-hidden="true" />
        <span class="app-header__brand-name">AI Chat</span>
      </div>
    </div>

    <!-- Right: actions -->
    <div class="app-header__right">
      <!-- New chat -->
      <button
        class="app-header__icon-btn"
        aria-label="New chat"
        title="New chat"
        @click="$emit('newChat')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <!-- Theme toggle -->
      <button
        class="app-header__icon-btn"
        :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        :title="theme === 'dark' ? 'Light mode' : 'Dark mode'"
        @click="toggleTheme"
      >
        <!-- Sun icon for dark → light -->
        <svg
          v-if="theme === 'dark'"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <!-- Moon icon for light → dark -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  height: var(--header-height);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: var(--z-above);
  flex-shrink: 0;

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex: 1;
  }

  &__right {
    justify-content: flex-end;
  }

  &__center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    user-select: none;
  }

  &__brand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--color-primary-gradient-from),
      var(--color-primary-gradient-to)
    );
    animation: pulse 2.5s ease-in-out infinite;
  }

  &__brand-name {
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }

  &__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);

    &:hover {
      background: var(--color-bg-muted);
      color: var(--color-text-primary);
    }

    &:active {
      transform: scale(0.93);
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.9); }
}
</style>
