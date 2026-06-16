import { create } from 'zustand'
import type { User, LinkedWallet } from '@tenda/shared'
import {
  getJwtToken,
  setJwtToken,
  getWalletAddress,
  setWalletAddress,
  clearAuthStorage,
} from '@/lib/secure-store'
import { api, ApiClientError } from '@/api/client'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import { useExchangeMarketStore } from '@/stores/exchange-market.store'
import { signInWithWallet as walletSignIn } from '@/wallet/auth'
import type { WalletAdapter } from '@/wallet/adapters/types'

interface AuthState {
  user: User | null
  jwt: string | null
  walletAddress: string | null
  /**
   * Connected EVM account (CO3) — session-scoped, set by `signInWithWallet`
   * on an eip155 sign-in and cleared on logout. NOT persisted: after a
   * restart it stays null and the evm-tx dispatch path falls back to the
   * verified linked eip155 wallet (from `wallets[]`). It only bridges the
   * window between an EVM login and the first `refreshMe`.
   */
  evmAddress: string | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Stage 1 multi-wallet state — from GET /v1/users/me. */
  wallets: LinkedWallet[]
  /** null until /v1/users/me has answered at least once this session. */
  profileComplete: boolean | null
  phoneVerified: boolean

  /**
   * Sign in with any wallet adapter (nonce → authenticate → JWT). Resolves to
   * false when the user declines in the wallet, true on success. Throws on
   * transport or server failure. The connected account's address is published
   * to the namespace-appropriate slot (`walletAddress` for Solana — consumed
   * as a Solana pubkey — or `evmAddress` for EVM).
   */
  signInWithWallet: (
    adapter: WalletAdapter,
    opts?: { is_seeker?: boolean; country?: string | null },
  ) => Promise<boolean>
  logout: () => Promise<void>
  loadSession: () => Promise<void>
  updateUser: (user: User) => void
  refreshUser: () => Promise<void>
  /** Re-fetch wallets + profile_complete from /v1/users/me. */
  refreshMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  jwt: null,
  walletAddress: null,
  evmAddress: null,
  isAuthenticated: false,
  isLoading: true,
  wallets: [],
  profileComplete: null,
  phoneVerified: false,

  signInWithWallet: async (adapter, opts = {}) => {
    const result = await walletSignIn(adapter, opts)
    if (result === null) return false

    const { auth, account } = result
    const isSolana = account.namespace === 'solana'
    await Promise.all([
      setJwtToken(auth.token),
      // walletAddress is consumed as a Solana pubkey (balance, fiat quotes) —
      // only persist it for a Solana account; an EVM login publishes evmAddress.
      isSolana ? setWalletAddress(account.address) : Promise.resolve(),
    ])
    set({
      user: auth.user,
      jwt: auth.token,
      ...(isSolana
        ? { walletAddress: account.address }
        : { evmAddress: account.address }),
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
      walletAddress: null,
      evmAddress: null,
      isAuthenticated: false,
      wallets: [],
      profileComplete: null,
      phoneVerified: false,
    })
  },

  loadSession: async () => {
    // Declare outside try so the catch block can reference them.
    // If the SecureStore read itself fails, both remain null and the catch
    // will set isLoading: false with no credentials — safe default.
    let jwt: string | null = null
    let walletAddress: string | null = null

    try {
      const stored = await Promise.all([getJwtToken(), getWalletAddress()])
      jwt           = stored[0]
      walletAddress = stored[1]

      if (!jwt) {
        set({ jwt: null, walletAddress, isAuthenticated: false, isLoading: false })
        return
      }

      const user = await api.auth.me()
      set({ user, jwt, walletAddress, isAuthenticated: true, isLoading: false })
      // Wallets + profile_complete ride a second, non-blocking call — the
      // legacy /v1/auth/me shape feeds the existing screens unchanged.
      void get().refreshMe()
    } catch (e) {
      if (e instanceof ApiClientError && (e.statusCode === 401 || e.statusCode === 403)) {
        await clearAuthStorage()
        set({
          user: null,
          jwt: null,
          walletAddress: null,
          isAuthenticated: false,
          isLoading: false,
        })
      } else {
        // Transient network error — commit the credentials we already read from SecureStore
        // into Zustand state so the UI shows a "reconnecting" state rather than the login screen.
        set({ jwt, walletAddress, isLoading: false })
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
}))

/**
 * Selector hook for the current user's seeker status.
 * Used to pick `seeker_fee_bps` vs `fee_bps` and to gate seeker-only UI.
 */
export const useIsSeeker = (): boolean =>
  useAuthStore((s) => s.user?.is_seeker ?? false)
