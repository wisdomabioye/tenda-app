/**
 * Expire stale fiat quotes (stage-8 § jobs). Repeatable BullMQ job (#33):
 * quoted / awaiting_user intents past their quote validity transition to
 * 'failed'. `initiateIntent` also expires lazily on touch — this job just
 * keeps abandoned rows from lingering as open.
 *
 * NOTE: awaiting_user intents that expire are FAILED, not silently
 * retried — the provider re-quotes on late settlement per the stage-8
 * risk table (never honor an expired quote at the original rate).
 */

import { RECONCILE_BATCH_LIMIT } from '@server/features/fiat-rails/config'
import type { FiatDeps } from '@server/features/fiat-rails/service'

export interface ExpireFiatQuotesResult {
  expired: number
}

export async function expireFiatQuotesHandler(deps: FiatDeps): Promise<ExpireFiatQuotesResult> {
  const now = deps.now()
  const stale = await deps.store.listExpiredQuotes(now, RECONCILE_BATCH_LIMIT)
  let expired = 0
  for (const intent of stale) {
    const updated = await deps.store.transition(intent.id, ['quoted', 'awaiting_user'], {
      status: 'failed',
    })
    if (updated !== null) {
      expired += 1
      // Never-initiated quotes (no provider_ref) expire SILENTLY — every
      // debounced amount edit on the Buy/Sell page creates one, and a
      // delayed "failed" push for each abandoned keystroke would be noise.
      // Only initiated intents (the user saw an instruction) notify.
      if (updated.provider_ref !== null) {
        deps.events.failed({
          intent_id: updated.id,
          user_id: updated.user_id,
          direction: updated.direction,
          fiat_currency: updated.fiat_currency,
          fiat_amount: updated.fiat_amount,
          asset: updated.asset,
          asset_amount_raw: updated.asset_amount_raw,
          reason: 'quote expired',
        })
      }
    }
  }
  return { expired }
}
