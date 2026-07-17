// ============================================================
// Chat Store — Pinia
// Manages conversation sessions and sidebar state
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { uid } from '../utils/uid'

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export const useChatStore = defineStore('chat', () => {
  // ── State ───────────────────────────────────────────────────
  const conversations = ref<Conversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const isSidebarOpen = ref<boolean>(true)

  // ── Getters ─────────────────────────────────────────────────
  const activeConversation = computed(() =>
    conversations.value.find(c => c.id === activeConversationId.value) ?? null,
  )

  const sortedConversations = computed(() =>
    [...conversations.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  )

  // ── Actions ─────────────────────────────────────────────────

  function createConversation(title = 'New Chat'): Conversation {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: uid(),
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }
    conversations.value.unshift(conversation)
    activeConversationId.value = conversation.id
    return conversation
  }

  function updateConversation(
    id: string,
    updates: Partial<Omit<Conversation, 'id' | 'createdAt'>>,
  ): void {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      Object.assign(conv, updates, { updatedAt: new Date().toISOString() })
    }
  }

  function deleteConversation(id: string): void {
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx !== -1) {
      conversations.value.splice(idx, 1)
      if (activeConversationId.value === id) {
        activeConversationId.value = conversations.value[0]?.id ?? null
      }
    }
  }

  function setActive(id: string): void {
    activeConversationId.value = id
  }

  function toggleSidebar(): void {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  return {
    conversations,
    activeConversationId,
    isSidebarOpen,
    activeConversation,
    sortedConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    setActive,
    toggleSidebar,
  }
})
