import { WalletError } from './errors'
import { isUserRejection } from './connect-then-sign'

/**
 * Untrusted provider boundary: only an explicit pre-broadcast schema rejection
 * permits a retry without feeCurrency. Never classify ambiguous transport or
 * application failures as safe to retry, even if their message matches.
 */
export function rejectsFeeCurrency(error: unknown): boolean {
  if (isUserRejection(error) || error instanceof WalletError) return false
  if (typeof error !== 'object' || error === null || !('message' in error)) return false
  return typeof error.message === 'string'
    && /invalid params feeCurrency\b/i.test(error.message)
    && /Expected a value of type [`'"]?never\b/i.test(error.message)
}
