import { create } from 'zustand'
import type { User, WalletAuthBody } from '@tenda/shared'
import {
  getJwtToken,
  setJwtToken,
  getMwaAuthToken,
  setMwaAuthToken,
  getWalletAddress,
  setWalletAddress,
  clearAuthStorage,
} from '@/lib/secure-store'
import { api } from '@/api/client'

interface WalletSessionInfo {
  mwaAuthToken: string
  walletAddress: string
}

interface AuthState {
  user: User | null
  jwt: string | null
  mwaAuthToken: string | null
  walletAddress: string | null
  isAuthenticated: boolean
  isLoading: boolean

  authenticateWithWallet: (body: WalletAuthBody, session: WalletSessionInfo) => Promise<void>
  logout: () => Promise<void>
  loadSession: () => Promise<void>
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  jwt: null,
  mwaAuthToken: null,
  walletAddress: null,
  isAuthenticated: false,
  isLoading: true,

  authenticateWithWallet: async (body, session) => {
    const { token, user } = await api.auth.wallet(body);
    await Promise.all([
      setJwtToken(token),
      setMwaAuthToken(session.mwaAuthToken),
      setWalletAddress(session.walletAddress),
    ])
    set({
      user,
      jwt: token,
      mwaAuthToken: session.mwaAuthToken,
      walletAddress: session.walletAddress,
      isAuthenticated: true,
    })
  },

  logout: async () => {
    await clearAuthStorage()
    set({ user: null, jwt: null, mwaAuthToken: null, walletAddress: null, isAuthenticated: false })
  },

  loadSession: async () => {
    try {
      const [jwt, mwaAuthToken, walletAddress] = await Promise.all([
        getJwtToken(),
        getMwaAuthToken(),
        getWalletAddress(),
      ])

      if (!jwt) {
        set({ jwt: null, mwaAuthToken, walletAddress, isAuthenticated: false, isLoading: false })
        return
      }

      const user = await api.auth.me()
      set({ user, jwt, mwaAuthToken, walletAddress, isAuthenticated: true, isLoading: false })
    } catch {
      await clearAuthStorage()
      set({
        user: null,
        jwt: null,
        mwaAuthToken: null,
        walletAddress: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  updateUser: (user) => set({ user }),
}))
