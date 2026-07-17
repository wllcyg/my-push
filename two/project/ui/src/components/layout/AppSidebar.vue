<script setup lang="ts">
import { useChatStore } from '../../stores/chatStore'

const chatStore = useChatStore()

defineEmits<{
  newChat: []
  selectConversation: [id: string]
}>()
</script>

<template>
  <aside class="app-sidebar" :aria-hidden="!chatStore.isSidebarOpen">
    <!-- Sidebar Header -->
    <div class="app-sidebar__header">
      <span class="app-sidebar__title">Conversations</span>
      <button
        class="app-sidebar__new-btn"
        aria-label="New conversation"
        @click="$emit('newChat')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>

    <!-- Conversation list -->
    <nav class="app-sidebar__nav" aria-label="Conversation history">
      <div
        v-if="chatStore.sortedConversations.length === 0"
        class="app-sidebar__empty"
      >
        No conversations yet
      </div>

      <button
        v-for="conv in chatStore.sortedConversations"
        :key="conv.id"
        class="app-sidebar__item"
        :class="{ 'app-sidebar__item--active': conv.id === chatStore.activeConversationId }"
        :aria-current="conv.id === chatStore.activeConversationId ? 'page' : undefined"
        @click="$emit('selectConversation', conv.id)"
      >
        <svg
          class="app-sidebar__item-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span class="app-sidebar__item-title truncate">{{ conv.title }}</span>
      </button>
    </nav>

    <!-- Footer -->
    <div class="app-sidebar__footer">
      <div class="app-sidebar__footer-info">
        <div class="app-sidebar__footer-dot" aria-hidden="true" />
        <span>Vue AI Chat</span>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.app-sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: var(--color-bg-sidebar);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-4) var(--space-3);
    border-bottom: 1px solid var(--color-border-subtle);
    height: var(--header-height);
    flex-shrink: 0;
  }

  &__title {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  &__new-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--duration-fast);

    &:hover {
      background: var(--color-bg-muted);
      color: var(--color-text-primary);
    }
  }

  &__nav {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) var(--space-2);
  }

  &__empty {
    padding: var(--space-4) var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    text-align: center;
  }

  &__item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    transition: all var(--duration-fast);
    margin-bottom: 2px;

    &:hover {
      background: var(--color-bg-muted);
      color: var(--color-text-primary);
    }

    &--active {
      background: var(--color-primary-light);
      color: var(--color-primary);

      .app-sidebar__item-icon {
        color: var(--color-primary);
      }
    }
  }

  &__item-icon {
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: color var(--duration-fast);
  }

  &__item-title {
    flex: 1;
    min-width: 0;
  }

  &__footer {
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
    flex-shrink: 0;
  }

  &__footer-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  &__footer-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-success);
    animation: pulse 2s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
