import { create } from 'zustand'
import type { User, LinkedWallet } from '@tenda/shared'
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
import { useExchangeMarketStore } from '@/stores/exchange-market.store'
import { solanaSignIn } from '@/wallet/auth'

interface AuthState {
  user: User | null
  jwt: string | null
  mwaAuthToken: string | null
  walletAddress: string | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Stage 1 multi-wallet state — from GET /v1/users/me. */
  wallets: LinkedWallet[]
  /** null until /v1/users/me has answered at least once this session. */
  profileComplete: boolean | null
  phoneVerified: boolean

  /**
   * Full MWA sign-in (nonce → connect+sign → JWT). Resolves to false when
   * the user declines in the wallet, true on success. Throws on transport
   * or server failure.
   */
  signInWithSolana: (opts?: { is_seeker?: boolean; country?: string | null }) => Promise<boolean>
  logout: () => Promise<void>
  loadSession: () => Promise<void>
  updateUser: (user: User) => void
  refreshUser: () => Promise<void>
  /** Re-fetch wallets + profile_complete from /v1/users/me. */
  refreshMe: () => Promise<void>
  setMwaAuthToken: (token: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  jwt: null,
  mwaAuthToken: null,
  walletAddress: null,
  isAuthenticated: false,
  isLoading: true,
  wallets: [],
  profileComplete: null,
  phoneVerified: false,

  signInWithSolana: async (opts = {}) => {
    const result = await solanaSignIn({
      mwaAuthToken: get().mwaAuthToken ?? undefined,
      ...opts,
    })
    if (result === null) return false

    const { auth, session } = result
    await Promise.all([
      setJwtToken(auth.token),
      setMwaAuthToken(session.authToken),
      setWalletAddress(session.address),
    ])
    set({
      user: auth.user,
      jwt: auth.token,
      mwaAuthToken: session.authToken,
      walletAddress: session.address,
      isAuthenticated: true,
      // The auth response is the v2 row — same predicate the server uses.
      profileComplete: Boolean(auth.user.first_name && auth.user.last_name),
    })

    // Settle the legacy /v1/auth/me user shape (wallet_address etc.) and
    // wallets[] + phone state in the background; navigation only needs
    // profileComplete, already set above.
    void get().refreshUser()
    void get().refreshMe()
    return true
  },

  logout: async () => {
    useExchangeMarketStore.getState().clear()
    await usePendingSyncStore.getState().clear()
    await clearAuthStorage()
    set({
      user: null,
      jwt: null,
      mwaAuthToken: null,
      walletAddress: null,
      isAuthenticated: false,
      wallets: [],
      profileComplete: null,
      phoneVerified: false,
    })
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
      // Wallets + profile_complete ride a second, non-blocking call — the
      // legacy /v1/auth/me shape feeds the existing screens unchanged.
      void get().refreshMe()
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

  refreshUser: async () => {
    try {
      const user = await api.auth.me()
      set({ user })
    } catch {
      // Silently ignore — stale data is better than a crash on focus
    }
  },

  refreshMe: async () => {
    try {
      const me = await api.users.me()
      set({
        wallets: me.wallets,
        profileComplete: me.profile_complete,
        phoneVerified: me.user.phone_verified_at !== null,
      })
    } catch {
      // Non-fatal — wallets UI shows a retry; profile gate falls back to
      // the value derived at sign-in.
    }
  },

  setMwaAuthToken: async (token) => {
    await setMwaAuthToken(token)
    set({ mwaAuthToken: token })
  },
}))

/**
 * Selector hook for the current user's seeker status.
 * Used to pick `seeker_fee_bps` vs `fee_bps` and to gate seeker-only UI.
 */
export const useIsSeeker = (): boolean =>
  useAuthStore((s) => s.user?.is_seeker ?? false)
