<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/authStore'

const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const name = ref('')

// 重置表单输入
function resetForm() {
  email.value = ''
  password.value = ''
  name.value = ''
  authStore.errorMessage = ''
}

// 监听模式切换，清空表单
watch(() => authStore.authMode, () => {
  resetForm()
})

watch(() => authStore.isAuthModalOpen, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})

// 提交表单
async function handleSubmit() {
  if (!email.value || !password.value) {
    authStore.errorMessage = '请填写必填项'
    return
  }

  if (authStore.authMode === 'register' && !name.value) {
    authStore.errorMessage = '请输入您的昵称'
    return
  }

  if (authStore.authMode === 'login') {
    await authStore.login(email.value, password.value)
  } else {
    await authStore.register(email.value, password.value, name.value)
  }
}

// ESC 关闭弹窗
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && authStore.isAuthModalOpen) {
    authStore.closeAuthModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Transition name="auth-fade">
    <div
      v-if="authStore.isAuthModalOpen"
      class="auth-backdrop"
      @click.self="authStore.closeAuthModal"
    >
      <div class="auth-modal" role="dialog" aria-modal="true">
        <!-- Close button -->
        <button
          class="auth-modal__close"
          aria-label="关闭"
          @click="authStore.closeAuthModal"
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
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- Header tabs -->
        <div class="auth-modal__header">
          <div class="auth-tabs">
            <button
              class="auth-tab"
              :class="{ active: authStore.authMode === 'login' }"
              @click="authStore.authMode = 'login'"
            >
              账号登录
            </button>
            <button
              class="auth-tab"
              :class="{ active: authStore.authMode === 'register' }"
              @click="authStore.authMode = 'register'"
            >
              免费注册
            </button>
          </div>
        </div>

        <!-- Error Alert -->
        <Transition name="auth-slide">
          <div v-if="authStore.errorMessage" class="auth-alert">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <span>{{ authStore.errorMessage }}</span>
          </div>
        </Transition>

        <!-- Form -->
        <form class="auth-form" @submit.prevent="handleSubmit">
          <!-- Name field (Register only) -->
          <div v-if="authStore.authMode === 'register'" class="auth-field">
            <label class="auth-label">用户昵称 / 姓名</label>
            <div class="auth-input-wrapper">
              <input
                v-model="name"
                type="text"
                class="auth-input"
                placeholder="请输入您的昵称"
                required
              />
            </div>
          </div>

          <!-- Email field -->
          <div class="auth-field">
            <label class="auth-label">电子邮箱</label>
            <div class="auth-input-wrapper">
              <input
                v-model="email"
                type="email"
                class="auth-input"
                placeholder="name@example.com"
                required
              />
            </div>
          </div>

          <!-- Password field -->
          <div class="auth-field">
            <label class="auth-label">登录密码</label>
            <div class="auth-input-wrapper">
              <input
                v-model="password"
                type="password"
                class="auth-input"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="auth-submit-btn"
            :disabled="authStore.isLoading"
          >
            <span v-if="!authStore.isLoading">
              {{ authStore.authMode === 'login' ? '立即登录' : '注册账号' }}
            </span>
            <span v-else class="auth-spinner"></span>
          </button>
        </form>

        <!-- Footer switch tip -->
        <div class="auth-modal__footer">
          <span v-if="authStore.authMode === 'login'">
            还没有账号？
            <a href="#" @click.prevent="authStore.authMode = 'register'">立即免费注册</a>
          </span>
          <span v-else>
            已有账号？
            <a href="#" @click.prevent="authStore.authMode = 'login'">立即登录</a>
          </span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.auth-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  padding: var(--space-4);
}

.auth-modal {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-overlay, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg, 16px);
  padding: var(--space-6);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: var(--color-text-tertiary, #94a3b8);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: var(--color-bg-muted, #f1f5f9);
      color: var(--color-text-primary);
    }
  }

  &__header {
    margin-top: 8px;
  }

  &__footer {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary, #64748b);
    margin-top: 4px;

    a {
      color: var(--color-primary, #2563eb);
      font-weight: 500;
      text-decoration: none;
      margin-left: 4px;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.auth-tabs {
  display: flex;
  gap: 16px;
  border-bottom: 2px solid var(--color-border-subtle, #e2e8f0);

  .auth-tab {
    padding-bottom: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-tertiary, #94a3b8);
    background: none;
    border: none;
    cursor: pointer;
    position: relative;
    transition: color 0.2s;

    &.active {
      color: var(--color-text-primary);

      &::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--color-primary, #2563eb);
        border-radius: 2px;
      }
    }
  }
}

.auth-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md, 8px);
  color: var(--color-error, #ef4444);
  font-size: 13px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
}

.auth-input-wrapper {
  position: relative;

  .auth-input {
    width: 100%;
    padding: 10px 14px;
    font-size: 14px;
    background: var(--color-bg-base, #ffffff);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    color: var(--color-text-primary);
    outline: none;
    transition: all 0.2s;

    &:focus {
      border-color: var(--color-primary, #2563eb);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
  }
}

.auth-submit-btn {
  margin-top: 8px;
  width: 100%;
  padding: 11px;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.95;
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.auth-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: auth-spin 0.8s linear infinite;
}

@keyframes auth-spin {
  to { transform: rotate(360deg); }
}

.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: opacity 0.25s ease;
}

.auth-fade-enter-from,
.auth-fade-leave-to {
  opacity: 0;
}

.auth-slide-enter-active,
.auth-slide-leave-active {
  transition: all 0.2s ease;
}

.auth-slide-enter-from,
.auth-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
