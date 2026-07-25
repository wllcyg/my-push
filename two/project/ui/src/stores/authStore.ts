import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: number
  email: string
  name: string
  created_at?: string
}

export const useAuthStore = defineStore('auth', () => {
  // ── State ───────────────────────────────────────────────────
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const user = ref<UserInfo | null>(
    localStorage.getItem('auth_user') 
      ? JSON.parse(localStorage.getItem('auth_user')!) 
      : null
  )
  const isAuthModalOpen = ref<boolean>(false)
  const authMode = ref<'login' | 'register'>('login')
  const isLoading = ref<boolean>(false)
  const errorMessage = ref<string>('')

  // ── Getters ─────────────────────────────────────────────────
  const isLoggedIn = computed(() => !!token.value && !!user.value)

  // ── Actions ─────────────────────────────────────────────────
  function openAuthModal(mode: 'login' | 'register' = 'login') {
    authMode.value = mode
    errorMessage.value = ''
    isAuthModalOpen.value = true
  }

  function closeAuthModal() {
    isAuthModalOpen.value = false
    errorMessage.value = ''
  }

  function setAuthData(newToken: string, newUser: UserInfo) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  async function login(email: string, password: string): Promise<boolean> {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const res = await fetch('http://127.0.0.1:8521/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (data.code === 0 && data.data) {
        setAuthData(data.data.access_token, data.data.user)
        closeAuthModal()
        return true
      } else {
        errorMessage.value = data.message || '登录失败，请检查账号密码'
        return false
      }
    } catch (err: any) {
      errorMessage.value = '网络请求失败，请确保后端 API 已启动'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function register(email: string, password: string, name: string): Promise<boolean> {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const res = await fetch('http://127.0.0.1:8521/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()

      if (data.code === 0 && data.data) {
        setAuthData(data.data.access_token, data.data.user)
        closeAuthModal()
        return true
      } else {
        errorMessage.value = data.message || '注册失败，请检查输入项'
        return false
      }
    } catch (err: any) {
      errorMessage.value = '网络请求失败，请确保后端 API 已启动'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMe(): Promise<void> {
    if (!token.value) return
    try {
      const res = await fetch('http://127.0.0.1:8521/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        user.value = data.data
        localStorage.setItem('auth_user', JSON.stringify(data.data))
      } else {
        // Token 失效清理
        logout()
      }
    } catch (e) {
      console.warn('[Auth] 获取当前用户信息失败', e)
    }
  }

  function initAuth() {
    if (token.value) {
      fetchMe()
    }
  }

  return {
    token,
    user,
    isAuthModalOpen,
    authMode,
    isLoading,
    errorMessage,
    isLoggedIn,
    openAuthModal,
    closeAuthModal,
    login,
    register,
    logout,
    fetchMe,
    initAuth,
  }
})
