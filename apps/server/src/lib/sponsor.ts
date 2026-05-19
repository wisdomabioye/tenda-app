/**
 * Sponsored-tx reservation. See stage-0 § Sponsored-tx reservation pattern.
 *
 * Naïve "decrement on confirmation" creates an over-spend race when a user
 * fires N sponsored UserOps in parallel. This module reserves atomically at
 * build time and reconciles on verify-tx outcome.
 *
 * Status: signatures-only scaffold. Implementation lands with `lib/escrow.ts`
 * + `chains/evm/paymaster.ts` (Stage 3).
 *
 * Test coverage owed:
 *   - 10 parallel reserve() calls with sponsored_tx_remaining=3 → exactly 3 succeed
 *   - release() restores the counter without going above the cap
 *   - reserve() is no-op for chains where paymaster is not configured
 *   - reserve() short-circuits when sponsored_tx_remaining <= 0
 */

import type { ChainId } from '@server/chains/types'

/**
 * Discriminated so `reservation_id` is only accessible after the
 * `sponsored: true` check — release/commit can't be called on an unsponsored
 * result by accident.
 */
export type ReservationResult =
  | { sponsored: false }
  | {
      sponsored: true
      /**
       * `tx_attempts.id` of the row reserved at build time. The same id is
       * the `was_sponsored` row the verify-tx job marks confirmed/failed.
       */
      reservation_id: string
    }

export declare function reserveSponsoredTx(args: {
  user_id: string
  chain_id: ChainId
}): Promise<ReservationResult>

/** Restore a reservation after client-side abort or verify-tx failure. */
export declare function releaseSponsoredTx(args: {
  user_id: string
  reservation_id: string
}): Promise<void>

/**
 * Commit a reservation on confirmation. Most paymasters: no-op (the decrement
 * was the reservation). Provided for symmetry / future paymaster models that
 * defer the deduction.
 */
export declare function commitSponsoredTx(args: {
  user_id: string
  reservation_id: string
}): Promise<void>
