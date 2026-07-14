/**
 * Wallet-state sync helpers for the auth store. Split out so the reconcile is a
 * pure, unit-testable function and the store file stays lean. `wallets[]` (from
 * GET /v1/users/me) is the SINGLE source of truth for the user's linked wallets;
 * this folds a fresh answer into the store's slice and classifies a failure as
 * retriable or terminal.
 */

import type { LinkedWallet, MeResponse } from '@tenda/shared'
import { ApiClientError } from '@/api/client'
import { isLinkedWallet } from '@/wallet/wallet-address'

/**
 * Lifecycle of the wallets[] load. Distinguishes the three states the old
 * `wallets.length === 0` overload conflated: still loading, loaded-but-empty
 * (genuinely no linked wallet), and failed (so the UI can offer a retry instead
 * of lying that the user has no wallet).
 */
export type WalletsStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The session-address slice the reconcile reads and rewrites. */
export interface WalletSlice {
  walletAddress: string | null
  evmAddress: string | null
}

export interface ReconciledWalletState extends WalletSlice {
  wallets: LinkedWallet[]
  profileComplete: boolean
}

/**
 * Fold a fresh /v1/users/me answer into the store's wallet slice. A session
 * address slot (solana `walletAddress`, evm `evmAddress`) is kept ONLY while it
 * is still a verified linked wallet, else dropped — so the store never
 * advertises a wallet the user has unlinked.
 */
export function reconcileWalletState(current: WalletSlice, me: MeResponse): ReconciledWalletState {
  return {
    wallets: me.wallets,
    profileComplete: me.profile_complete,
    walletAddress:
      current.walletAddress !== null && isLinkedWallet('solana', current.walletAddress, me.wallets)
        ? current.walletAddress
        : null,
    evmAddress:
      current.evmAddress !== null && isLinkedWallet('eip155', current.evmAddress, me.wallets)
        ? current.evmAddress
        : null,
  }
}

/**
 * Whether a /v1/users/me failure is worth retrying. A transport/5xx blip is
 * transient → retry; an auth failure (401/403) is terminal → surface at once so
 * the caller re-authenticates rather than hammering a dead token.
 */
export function isRetriableMeError(error: unknown): boolean {
  if (error instanceof ApiClientError) return error.statusCode !== 401 && error.statusCode !== 403
  return true
}
