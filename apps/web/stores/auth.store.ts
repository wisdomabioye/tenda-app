import { create } from 'zustand'
import {
  ApiClientError,
  ErrorCode,
  hasCompleteName,
  type IdentityMethodWire,
  type LinkedWallet,
  type User,
  type VerifyBody,
} from '@tenda/shared'
import { api } from '@/api/client'
import { clearAuthStorage, getJwtToken, JWT_TOKEN_KEY, setJwtToken } from '@/lib/storage'
import { signInWithWallet as walletSignIn, linkWalletWith } from '@/wallet/auth'
import { reownAdapter } from '@/wallet/adapters/reown'
import { useNotificationsStore } from '@/stores/notifications.store'
import { useChatStore } from '@/stores/chat.store'
import { clearAccountCaches } from '@/lib/account-caches'
import type { WalletAdapter } from '@/wallet/adapters/types'

/**
 * Web port of apps/mobile/stores/auth.store.ts — same semantics (stale-bearer
 * purge, 401/403-clears vs transient-keeps bootstrap, the server's own
 * profile-complete predicate). Stage 3 adds the wallet half: sign-in/link via
 * the adapter seam and the LINKED wallets list (wallet-reliability doctrine:
 * linked(wallets[]) ≠ connected — the live connection belongs to AppKit, this
 * store only mirrors the server's registry).
 */
export interface AuthState {
  user: User | null
  jwt: string | null
  isAuthenticated: boolean
  /** True until the first loadSession resolves — gates render vs redirect. */
  isLoading: boolean
  /** null until known; false routes to /onboarding/profile. */
  profileComplete: boolean | null
  identities: IdentityMethodWire[]
  /** Server-verified linked wallets (never the live connection). */
  wallets: LinkedWallet[]
  walletsStatus: 'idle' | 'loading' | 'ready' | 'error'

  signInWithVerify: (body: VerifyBody) => Promise<{ isNew: boolean }>
  /** True = signed in; false = user declined in the wallet. WALLET_NOT_LINKED throws. */
  signInWithWallet: (adapter: WalletAdapter) => Promise<boolean>
  /** True = linked; false = user declined. Collision/errors throw. */
  linkWallet: (adapter: WalletAdapter) => Promise<boolean>
  refreshWallets: () => Promise<void>
  linkIdentity: (body: VerifyBody) => Promise<void>
  loadMethods: () => Promise<void>
  logout: () => Promise<void>
  loadSession: () => Promise<void>
  refreshUser: () => Promise<void>
  updateUser: (user: User) => void
  setProfileComplete: (complete: boolean) => void
}

/**
 * A SIGN-IN call answered 401 UNAUTHORIZED — only the server's JWT guard
 * mints that code, so a dead stored token leaked onto the request. Purge it
 * so the very next attempt starts clean (mobile's purgeIfStaleSession).
 */
async function purgeIfStaleSession(e: unknown): Promise<void> {
  if (e instanceof ApiClientError && e.statusCode === 401 && e.code === ErrorCode.UNAUTHORIZED) {
    await clearAuthStorage()
    useAuthStore.setState({ jwt: null, isAuthenticated: false })
  }
}

const SIGNED_OUT = {
  user: null,
  jwt: null,
  isAuthenticated: false,
  profileComplete: null,
  identities: [] as IdentityMethodWire[],
  wallets: [] as LinkedWallet[],
  walletsStatus: 'idle' as const,
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...SIGNED_OUT,
  isLoading: true,

  signInWithVerify: async (body) => {
    const res = await api.auth.verify(body).catch(async (e: unknown) => {
      await purgeIfStaleSession(e)
      throw e
    })
    await setJwtToken(res.token)
    set({
      user: res.user,
      jwt: res.token,
      isAuthenticated: true,
      isLoading: false,
      // Same profile-complete predicate the server uses — cannot drift.
      profileComplete: hasCompleteName(res.user.first_name, res.user.last_name),
    })
    return { isNew: res.is_new }
  },

  signInWithWallet: async (adapter) => {
    const result = await walletSignIn(adapter).catch(async (e: unknown) => {
      await purgeIfStaleSession(e)
      throw e
    })
    if (result === null) return false // declined in the wallet

    const { auth } = result
    await setJwtToken(auth.token)
    set({
      user: auth.user,
      jwt: auth.token,
      isAuthenticated: true,
      isLoading: false,
      profileComplete: hasCompleteName(auth.user.first_name, auth.user.last_name),
    })
    void get().refreshWallets()
    return true
  },

  linkWallet: async (adapter) => {
    const account = await linkWalletWith(adapter)
    if (account === null) return false
    // Reflect the freshly-linked wallet in the cached wallets[] list.
    await get().refreshWallets()
    return true
  },

  refreshWallets: async () => {
    set({ walletsStatus: 'loading' })
    try {
      const res = await api.users.me()
      set({ wallets: res.wallets, walletsStatus: 'ready' })
    } catch {
      // Keep the last-good list (never blank a rendered list to an error);
      // the status tells the screen to offer a retry.
      set({ walletsStatus: 'error' })
    }
  },

  linkIdentity: async (body) => {
    // link: true attaches the bearer → server LINKS instead of logging in.
    // The returned token is discarded: the current session stays untouched.
    await api.auth.verify(body, { link: true })
    await get().loadMethods()
    void get().refreshUser()
  },

  loadMethods: async () => {
    try {
      const res = await api.auth.methods()
      set({ identities: res.identities })
    } catch {
      // Non-fatal; the security surface offers a retry.
    }
  },

  logout: async () => {
    // Notifications stay global (the badge outlives its screen) and must be
    // dropped here so the next account never sees this account's notices
    // (mobile doctrine, stores/auth.store.ts).
    useNotificationsStore.getState().reset()
    // Same reason, same doctrine: sign-out is a soft navigation, so every
    // store and module-scoped cache in this tab outlives the session unless
    // it is emptied here. The inbox and the disputes column both hold rows
    // the next account must never see.
    useChatStore.getState().reset()
    clearAccountCaches()
    await clearAuthStorage()
    // Best-effort: drop the wallet session too, so the next sign-in shows the
    // picker instead of silently reusing a stale session across accounts
    // (mobile doctrine). peek-only — never boots the wallet stack to log out.
    await reownAdapter.disconnect().catch(() => {})
    set({ ...SIGNED_OUT, isLoading: false })
  },

  loadSession: async () => {
    let jwt: string | null = null
    try {
      jwt = await getJwtToken()
      if (jwt === null || jwt === '') {
        set({ ...SIGNED_OUT, isLoading: false })
        return
      }
      const user = await api.auth.me()
      set({
        user,
        jwt,
        isAuthenticated: true,
        isLoading: false,
        profileComplete: hasCompleteName(user.first_name, user.last_name),
      })
    } catch (e) {
      if (e instanceof ApiClientError && (e.statusCode === 401 || e.statusCode === 403)) {
        await clearAuthStorage()
        set({ ...SIGNED_OUT, isLoading: false })
      } else {
        // Transient failure: keep the stored credential for the next attempt
        // but treat the session as signed out for routing (mobile behavior).
        set({ jwt, isLoading: false })
      }
    }
  },

  refreshUser: async () => {
    try {
      const user = await api.auth.me()
      set({
        user,
        profileComplete: hasCompleteName(user.first_name, user.last_name),
      })
    } catch {
      // Stale data beats a crash on focus.
    }
  },

  updateUser: (user) => set({ user }),
  setProfileComplete: (complete) => set({ profileComplete: complete }),
}))

/**
 * Cross-tab session sync (stage-2 DoD: logout in tab A signs out tab B).
 * The `storage` event only fires in OTHER tabs, which is exactly the seam:
 * token removed elsewhere → drop local state; token appeared/changed
 * elsewhere → adopt it by re-running the bootstrap.
 */
export function initCrossTabAuthSync(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== JWT_TOKEN_KEY) return
    if (event.newValue === null) {
      useAuthStore.setState({ ...SIGNED_OUT, isLoading: false })
    } else {
      void useAuthStore.getState().loadSession()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
