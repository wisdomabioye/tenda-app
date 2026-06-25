import { create } from 'zustand'
import type { User, LinkedWallet, VerifyBody, IdentityMethodWire } from '@tenda/shared'
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
import { signInWithWallet as walletSignIn, linkWalletWith } from '@/wallet/auth'
import { connectionSignal } from '@/wallet/reown/connection-signal'
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
  /**
   * A wallet sign-in is mid-flight (nonce → authenticate → verify). The wallet's
   * `tenda://` return deep link can bounce the app through the `/` index route
   * before verify completes; `index` reads this to hold a spinner instead of
   * flashing the welcome/get-started screen. Cleared when the flow settles.
   */
  walletAuthInProgress: boolean
  /** Stage 1 multi-wallet state — from GET /v1/users/me. */
  wallets: LinkedWallet[]
  /** null until /v1/users/me has answered at least once this session. */
  profileComplete: boolean | null
  /**
   * Non-wallet sign-in identities (phone/email/OAuth) from GET /v1/auth/methods,
   * for the Sign-in & security screen. Empty until `loadMethods` answers.
   */
  identities: IdentityMethodWire[]

  /**
   * Sign in with any wallet adapter (nonce → authenticate → verify → JWT).
   * Find-or-reject (decision #3): an unknown wallet throws WALLET_NOT_LINKED;
   * the wallet never creates an account. Resolves to false when the user
   * declines in the wallet, true on success. Throws on transport or server
   * failure (the connect-wallet screen maps WALLET_NOT_LINKED to Tier-0). The
   * connected account's address is published to the namespace-appropriate slot
   * (`walletAddress` for Solana — consumed as a Solana pubkey — or `evmAddress`
   * for EVM).
   */
  signInWithWallet: (adapter: WalletAdapter) => Promise<boolean>
  /**
   * Link an ADDITIONAL wallet to the already-authenticated account (nonce →
   * authenticate(forceFresh) → POST /v1/auth/link-wallet → refreshMe). Sets
   * `walletAuthInProgress` for the same reason sign-in does: the new wallet's
   * `tenda://` return deep link bounces the app through `/`, and `index` must
   * hold a spinner rather than redirect an authed user home mid-link. Resolves
   * true on link, false when the user declines; throws ApiClientError (the
   * screen maps 409/etc. to a toast).
   */
  linkWallet: (adapter: WalletAdapter) => Promise<boolean>
  /**
   * Stage 9 unified sign-in — verify a credential proof (phone/email OTP,
   * OAuth id_token, or wallet signature) via POST /v1/auth/verify and set the
   * session. No wallet is required. Anonymous → login/create; an
   * already-authenticated caller LINKS (the request layer sends the JWT).
   * Returns whether the account was just created. Throws ApiClientError (the
   * caller maps WALLET_NOT_LINKED / IDENTITY_ALREADY_LINKED to the Tier-0 UX).
   */
  signInWithVerify: (body: VerifyBody) => Promise<{ isNew: boolean }>
  /**
   * Stage 9 — LINK a verified contact (phone/email OTP) to the ALREADY-signed-in
   * account, used by the Sign-in & security screen. Same POST /v1/auth/verify as
   * sign-in (bearer auto-attached → server links to the current user), but it
   * does NOT touch the session token or navigation — it just refreshes the
   * cached user/wallets/identities. Throws ApiClientError (the screen maps
   * IDENTITY_ALREADY_LINKED etc. to a toast).
   */
  linkIdentity: (body: VerifyBody) => Promise<void>
  /** Re-fetch sign-in identities from GET /v1/auth/methods. */
  loadMethods: () => Promise<void>
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
  walletAuthInProgress: false,
  wallets: [],
  profileComplete: null,
  identities: [],

  signInWithWallet: async (adapter) => {
    // Flag the in-flight sign-in so `index` holds a spinner instead of flashing
    // welcome if the wallet's `tenda://` return bounces through `/` mid-verify.
    set({ walletAuthInProgress: true })
    try {
      const result = await walletSignIn(adapter)
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
    } finally {
      set({ walletAuthInProgress: false })
    }
  },

  linkWallet: async (adapter) => {
    // Same in-flight flag as sign-in: the link's `tenda://` auto-return routes
    // through `/`, where `index` would otherwise redirect this authed user home
    // and pop the linked-wallets screen mid-link. Hold the spinner instead.
    set({ walletAuthInProgress: true })
    try {
      const account = await linkWalletWith(adapter)
      if (account === null) return false
      // Reflect the freshly-linked wallet in the cached wallets[] list.
      await get().refreshMe()
      return true
    } finally {
      set({ walletAuthInProgress: false })
    }
  },

  signInWithVerify: async (body) => {
    const res = await api.auth.verify(body)
    await setJwtToken(res.token)
    set({
      user: res.user,
      jwt: res.token,
      isAuthenticated: true,
      // Same profile-complete predicate the server uses.
      profileComplete: Boolean(res.user.first_name && res.user.last_name),
    })
    // Settle wallets[] + phone state in the background; navigation only needs
    // profileComplete, already set above.
    void get().refreshMe()
    return { isNew: res.is_new }
  },

  linkIdentity: async (body) => {
    // The request layer attaches the stored JWT → the server links this verified
    // identity to the current user (rather than creating/logging in). We discard
    // the returned token: the existing session is still valid and we must not
    // disturb the auth/nav state from a settings action.
    await api.auth.verify(body)
    // Reflect the new contact across the surfaces that show it.
    await Promise.all([get().refreshMe(), get().loadMethods()])
    void get().refreshUser()
  },

  loadMethods: async () => {
    try {
      const res = await api.auth.methods()
      set({ identities: res.identities })
    } catch {
      // Non-fatal — the security screen shows a retry; stale list is acceptable.
    }
  },

  logout: async () => {
    useExchangeMarketStore.getState().clear()
    await usePendingSyncStore.getState().clear()
    // Drop any WalletConnect (EVM) session so the next login starts clean and
    // shows the wallet sheet instead of silently reusing the prior wallet.
    // Fire-and-forget — logout must not block on a relay round-trip.
    void connectionSignal.disconnect()
    await clearAuthStorage()
    set({
      user: null,
      jwt: null,
      walletAddress: null,
      evmAddress: null,
      isAuthenticated: false,
      wallets: [],
      profileComplete: null,
      identities: [],
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
