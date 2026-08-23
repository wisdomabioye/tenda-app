/**
 * Pure helpers for auth.store — split out to keep the store within the file
 * budget; they carry no store state of their own.
 */
import { ApiClientError, type IdentityMethodWire, type LinkedWallet } from '@tenda/shared'

/**
 * A wallets[] load failure worth retrying: transient network/5xx blips, not a
 * terminal auth failure (401/403 means re-authenticate, not hammer a dead
 * token). Mobile's isRetriableMeError, same predicate.
 */
export function isRetriableMeError(error: unknown): boolean {
  if (error instanceof ApiClientError) return error.statusCode !== 401 && error.statusCode !== 403
  return true
}

/**
 * The signed-out slice, applied by logout, a failed bootstrap, and
 * `stores/auth/cross-tab.ts` when another tab drops the token.
 */
export const SIGNED_OUT = {
  user: null,
  jwt: null,
  isAuthenticated: false,
  profileComplete: null,
  identities: [] as IdentityMethodWire[],
  wallets: [] as LinkedWallet[],
  walletsStatus: 'idle' as const,
}
