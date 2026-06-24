/**
 * Stage 9C — Tier-0 mapping for the unified sign-in. A /v1/auth/verify failure
 * carrying WALLET_NOT_LINKED (wallet signs in but never creates) or
 * IDENTITY_ALREADY_LINKED (block, no merge) is not a generic error — it routes
 * the user to "get started / sign into the existing account" instead.
 */

import { ApiClientError } from '@/api/client'

export type Tier0Reason = 'wallet_not_linked' | 'identity_already_linked'

/** Map a verify failure to its Tier-0 reason, or null for a generic error. */
export function classifyVerifyError(err: unknown): Tier0Reason | null {
  if (err instanceof ApiClientError) {
    if (err.code === 'WALLET_NOT_LINKED') return 'wallet_not_linked'
    if (err.code === 'IDENTITY_ALREADY_LINKED') return 'identity_already_linked'
  }
  return null
}

/** User-facing copy for each Tier-0 reason. */
export const TIER0_MESSAGE: Record<Tier0Reason, string> = {
  wallet_not_linked:
    'This wallet isn’t linked to an account yet. Get started with phone, email, Google, or Apple — then link your wallet.',
  identity_already_linked:
    'This already belongs to another account. Try signing into that account instead.',
}
