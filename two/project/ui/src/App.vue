<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from './components/layout/AppLayout.vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import ChatWindow from './components/chat/ChatWindow.vue'
import ChatInput from './components/input/ChatInput.vue'
import DeepResearchViewer from './components/agent/DeepResearchViewer.vue'
import AuthModal from './components/auth/AuthModal.vue'
import { useChat } from './hooks/useChat'
import { useChatStore } from './stores/chatStore'
import { useAuthStore } from './stores/authStore'
import { useTheme } from './hooks/useTheme'

// ── Initialize theme & Auth ──────────────────────────────────
useTheme()
const authStore = useAuthStore()
const chatStore = useChatStore()

onMounted(async () => {
  authStore.initAuth()
  await chatStore.loadSessions(1)
  // 如果加载到了历史会话，默认载入第一个会话的泡泡
  if (chatStore.activeConversationId) {
    loadSessionMessages(chatStore.activeConversationId)
  }
})


// ── Mode Switch (Default to chat) ────────────────────────────
const activeMode = ref<'chat' | 'research'>('chat')

// ── Chat hook ───────────────────────────────────────────────
const { messages, input, loading, send, stop, clear, loadSessionMessages } = useChat({
  api: '/api/ai/chat/stream',
  getSessionId: () => chatStore.activeConversationId,
  setSessionId: (id: string) => {
    chatStore.activeConversationId = id
  },
  getUserId: () => 1,
  onFinish: () => {
    // 每次对话完成刷新侧边栏
    chatStore.loadSessions(1)
  },
  onError: (err) => console.error('[Chat Error]', err),
})

// ── Toast Message 提示系统 ────────────────────────────────────
const toastText = ref<string>('')
let toastTimer: any = null

function showToast(msg: string) {
  toastText.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastText.value = ''
  }, 3000)
}

// ── Actions ─────────────────────────────────────────────────
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

function handleSend(): void {
  // 未登录校验与拦截
  if (!authStore.isLoggedIn) {
    showToast('⚠️ 请先登录后再发送消息！')
    authStore.openAuthModal('login')
    return
  }
  send()
}

function handleStop(): void {
  stop()
}

function handleNewChat(): void {
  clear()
  chatStore.activeConversationId = null
  chatInputRef.value?.focusInput()
}

function handleToggleSidebar(): void {
  chatStore.toggleSidebar()
}

function handleSelectConversation(id: string): void {
  chatStore.setActive(id)
  loadSessionMessages(id)
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

  <!-- Auth Login/Register Modal -->
  <AuthModal />

  <!-- Global Message Toast Notification -->
  <Transition name="toast-fade">
    <div v-if="toastText" class="app-toast-message">
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
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ toastText }}</span>
    </div>
  </Transition>
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

// Toast message notification
.app-toast-message {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(30, 41, 59, 0.9);
  color: #ffffff;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}
</style>
