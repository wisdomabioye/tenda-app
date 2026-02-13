import { create } from 'zustand'
import type { User, WalletAuthBody } from '@tenda/shared'
import { getToken, setToken, deleteToken } from '@/lib/secure-store'
import { api } from '@/api/client'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (body: WalletAuthBody) => Promise<void>
  logout: () => Promise<void>
  loadSession: () => Promise<void>
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (body) => {
    const { token, user } = await api.auth.wallet(body)
    await setToken(token)
    set({ user, token, isAuthenticated: true })
  },

  logout: async () => {
    await deleteToken()
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadSession: async () => {
    try {
      const token = await getToken()
      if (!token) {
        set({ isLoading: false })
        return
      }
      const user = await api.auth.me()
      set({ user, token, isAuthenticated: true, isLoading: false })
    } catch {
      await deleteToken()
      set({ user: null, token: null, isAuthenticated: false, isLoading: false })
    }
  },

  updateUser: (user) => set({ user }),
}))
