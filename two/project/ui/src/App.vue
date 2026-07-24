<script setup lang="ts">
import { ref } from 'vue'
import AppLayout from './components/layout/AppLayout.vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import ChatWindow from './components/chat/ChatWindow.vue'
import ChatInput from './components/input/ChatInput.vue'
import DeepResearchViewer from './components/agent/DeepResearchViewer.vue'
import { useChat } from './hooks/useChat'
import { useChatStore } from './stores/chatStore'
import { useTheme } from './hooks/useTheme'

// ── Initialize theme ─────────────────────────────────────────
useTheme()

// ── Mode Switch ──────────────────────────────────────────────
const activeMode = ref<'chat' | 'research'>('research')

// ── Chat hook ───────────────────────────────────────────────
const { messages, input, loading, send, stop, clear } = useChat({
  api: '/api/chat',
  onError: (err) => console.error('[Chat Error]', err),
})

// ── Store ───────────────────────────────────────────────────
const chatStore = useChatStore()

// ── Actions ─────────────────────────────────────────────────
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

function handleSend(): void {
  send()
}

function handleStop(): void {
  stop()
}

function handleNewChat(): void {
  clear()
  chatInputRef.value?.focusInput()
}

function handleToggleSidebar(): void {
  chatStore.toggleSidebar()
}

function handleSelectConversation(id: string): void {
  chatStore.setActive(id)
}

function handleSwitchMode(mode: 'chat' | 'research'): void {
  activeMode.value = mode
}
</script>

<template>
  <AppLayout>
    <!-- Sidebar -->
    <template #sidebar>
      <AppSidebar
        @new-chat="handleNewChat"
        @select-conversation="handleSelectConversation"
      />
    </template>

    <!-- Header -->
    <template #header>
      <AppHeader
        :current-mode="activeMode"
        @new-chat="handleNewChat"
        @toggle-sidebar="handleToggleSidebar"
        @switch-mode="handleSwitchMode"
      />
    </template>

    <!-- Content area: conditionally render Chat or Deep Research -->
    <template #content>
      <!-- Deep Research Agent Viewer -->
      <DeepResearchViewer v-if="activeMode === 'research'" />

      <!-- Normal Chat Window -->
      <ChatWindow
        v-else
        :messages="messages"
        :is-loading="loading"
        @new-chat="handleNewChat"
      />
    </template>

    <!-- Input area (Only visible in normal chat mode) -->
    <template #footer>
      <div v-if="activeMode === 'chat'" class="app-input-area">
        <ChatInput
          ref="chatInputRef"
          v-model="input"
          :is-loading="loading"
          @send="handleSend"
          @stop="handleStop"
        />
      </div>
    </template>
  </AppLayout>
</template>

<style lang="scss">
// Global error banner
.app-error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--color-error-bg);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  font-size: var(--text-sm);
  color: var(--color-error);
}

// Input area wrapper
.app-input-area {
  padding: var(--space-4) var(--space-6) var(--space-6);
  background: var(--color-bg-base);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}
</style>
