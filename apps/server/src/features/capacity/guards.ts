/**
 * assertGigCapacity — refuses an accept once the worker already holds
 * `platform_config.max_pending_gigs` live gigs.
 *
 * Called from inside the accept handler rather than as a preHandler, for two
 * reasons: `/v1/escrows/:id/accept` is kind-agnostic, so the escrow must be
 * loaded before we know whether the cap even applies (accepting a P2P trade
 * must never be blocked by a GIG cap); and `guardTransition` has already
 * loaded that row, so a preHandler would duplicate the query. Same placement
 * and throwing style as `assertCanTransact`, which sits beside it.
 *
 * This is a guardrail, not a security control. `acceptEscrow` on both chains
 * checks status, creator and deadline only, so a hand-crafted transaction can
 * still exceed the cap — and the event applier will faithfully record it,
 * because the DB must mirror the chain. `checkGigCapacity` therefore tolerates
 * `active > limit` rather than treating it as impossible.
 */

import { ErrorCode, type EscrowKind } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { getPlatformConfig } from '@server/lib/platform'
import { checkGigCapacity, capacityMessage } from '@server/features/capacity/service'
import { drizzleCapacityStore } from '@server/features/capacity/store'
import type { AppDatabase } from '@server/plugins/db'

export async function assertGigCapacity(
  db: AppDatabase,
  user_id: string,
  kind: EscrowKind,
): Promise<void> {
  if (kind !== 'gig') return

  const cfg = await getPlatformConfig(db)
  const active = await drizzleCapacityStore(db).countActiveGigs(
    user_id,
    new Date(),
    cfg.grace_period_seconds,
  )
  const check = checkGigCapacity(active, cfg.max_pending_gigs)
  if (check.allowed) return

  throw new AppError(403, ErrorCode.GIG_CAPACITY_REACHED, capacityMessage(check), {
    active: check.active,
    limit: check.limit,
    remaining: check.remaining,
  })
}
