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
import { api, ApiClientError } from '@/api/client'
import { usePendingSyncStore } from '@/stores/pending-sync.store'

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
  setMwaAuthToken: (token: string) => Promise<void>
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
    await usePendingSyncStore.getState().clear()
    await clearAuthStorage()
    set({ user: null, jwt: null, mwaAuthToken: null, walletAddress: null, isAuthenticated: false })
  },

  loadSession: async () => {
    // Declare outside try so the catch block can reference them.
    // If the SecureStore read itself fails, all three remain null and the
    // catch will set isLoading: false with no credentials — safe default.
    let jwt: string | null = null
    let mwaAuthToken: string | null = null
    let walletAddress: string | null = null

    try {
      const stored = await Promise.all([getJwtToken(), getMwaAuthToken(), getWalletAddress()])
      jwt          = stored[0]
      mwaAuthToken = stored[1]
      walletAddress = stored[2]

      if (!jwt) {
        set({ jwt: null, mwaAuthToken, walletAddress, isAuthenticated: false, isLoading: false })
        return
      }

      const user = await api.auth.me()
      set({ user, jwt, mwaAuthToken, walletAddress, isAuthenticated: true, isLoading: false })
    } catch (e) {
      if (e instanceof ApiClientError && (e.statusCode === 401 || e.statusCode === 403)) {
        await clearAuthStorage()
        set({
          user: null,
          jwt: null,
          mwaAuthToken: null,
          walletAddress: null,
          isAuthenticated: false,
          isLoading: false,
        })
      } else {
        // Transient network error — commit the credentials we already read from SecureStore
        // into Zustand state so the UI shows a "reconnecting" state rather than the login screen.
        set({ jwt, mwaAuthToken, walletAddress, isLoading: false })
      }
    }
  },

  updateUser: (user) => set({ user }),

  setMwaAuthToken: async (token) => {
    await setMwaAuthToken(token)
    set({ mwaAuthToken: token })
  },
}))
