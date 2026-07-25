// ============================================================
// Chat Store — Pinia
// Manages conversation sessions and sidebar state with API sync
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { uid } from '../utils/uid'
import { fetchUserSessions } from '../services/chatApi'

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
  const isLoadingSessions = ref<boolean>(false)

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

  /**
   * 从后端 API 加载用户的历史会话列表
   */
  async function loadSessions(userId: number = 1) {
    isLoadingSessions.value = true
    try {
      const res = await fetchUserSessions(userId)
      if (res.status === 'success' && Array.isArray(res.data)) {
        conversations.value = res.data.map((item: any) => ({
          id: item.session_id,
          title: item.title || '新对话',
          createdAt: item.updated_at || new Date().toISOString(),
          updatedAt: item.updated_at || new Date().toISOString(),
          messageCount: 0
        }))
        
        // 默认激活最新一条会话
        if (conversations.value.length > 0 && !activeConversationId.value) {
          activeConversationId.value = conversations.value[0].id
        }
      }
    } catch (err) {
      console.error('[loadSessions Error]', err)
    } finally {
      isLoadingSessions.value = false
    }
  }


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
    isLoadingSessions,
    activeConversation,
    sortedConversations,
    loadSessions,
    createConversation,
    updateConversation,
    deleteConversation,
    setActive,
    toggleSidebar,
  }
})

