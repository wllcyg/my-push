<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../../hooks/useTheme'
import { useChatStore } from '../../stores/chatStore'
import { useAuthStore } from '../../stores/authStore'

const { theme, toggleTheme } = useTheme()
const chatStore = useChatStore()
const authStore = useAuthStore()

const showUserMenu = ref(false)

function handleLogout() {
  showUserMenu.value = false
  authStore.logout()
  chatStore.activeConversationId = null
}

// 点击页面外部区域时自动收起/隐去用户信息下拉框
function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  const userMenuEl = document.querySelector('.user-menu-wrapper')
  if (showUserMenu.value && userMenuEl && !userMenuEl.contains(target)) {
    showUserMenu.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})

defineProps<{
  currentMode?: 'chat' | 'research'
}>()

defineEmits<{
  newChat: []
  toggleSidebar: []
  switchMode: [mode: 'chat' | 'research']
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

    <!-- Center: mode tabs (Deep research tab hidden as per request) -->
    <div class="app-header__center">
      <div class="app-header__brand">
        <span class="app-header__brand-dot"></span>
        <span class="app-header__brand-name">AI 智能对话助手</span>
      </div>
    </div>

    <!-- Right: actions & Auth -->
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

      <!-- Auth section -->
      <div class="auth-section">
        <button
          v-if="!authStore.isLoggedIn"
          class="auth-header-btn"
          @click="authStore.openAuthModal('login')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span>登录 / 注册</span>
        </button>

        <div v-else class="user-menu-wrapper">
          <button class="user-badge-btn" @click="showUserMenu = !showUserMenu">
            <span class="user-avatar">{{ authStore.user?.name.slice(0, 1).toUpperCase() }}</span>
            <span class="user-name">{{ authStore.user?.name }}</span>
          </button>

          <!-- User dropdown card -->
          <div v-if="showUserMenu" class="user-dropdown-card" @click="showUserMenu = false">
            <div class="user-info">
              <div class="user-name-title">{{ authStore.user?.name }}</div>
              <div class="user-email-text">{{ authStore.user?.email }}</div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="logout-btn" @click="handleLogout">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
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

    .mode-tabs {
      display: flex;
      background: var(--color-bg-muted, #f1f5f9);
      padding: 3px;
      border-radius: var(--radius-md, 8px);
      gap: 4px;

      .mode-btn {
        padding: 5px 14px;
        border: none;
        background: none;
        border-radius: 6px;
        font-size: var(--text-xs, 12px);
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.2s ease;

        &.active {
          background: var(--color-bg-overlay, #ffffff);
          color: var(--color-primary, #2563eb);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
      }
    }
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

// ── Auth & User Section Styles ──
.auth-section {
  margin-left: 8px;
  position: relative;
}

.auth-header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
  }
}

.user-menu-wrapper {
  position: relative;
}

.user-badge-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  background: var(--color-bg-muted, #f1f5f9);
  border: 1px solid var(--color-border-subtle, #e2e8f0);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-bg-overlay, #ffffff);
    border-color: var(--color-border, #cbd5e1);
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.user-dropdown-card {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 200px;
  background: var(--color-bg-overlay, #ffffff);
  border: 1px solid var(--color-border, #cbd5e1);
  border-radius: var(--radius-md, 12px);
  padding: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .user-info {
    .user-name-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .user-email-text {
      font-size: 12px;
      color: var(--color-text-secondary, #64748b);
      word-break: break-all;
    }
  }

  .dropdown-divider {
    height: 1px;
    background: var(--color-border-subtle, #e2e8f0);
    margin: 4px 0;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--color-error, #ef4444);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--color-error-bg, rgba(239, 68, 68, 0.1));
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.9); }
}
</style>
