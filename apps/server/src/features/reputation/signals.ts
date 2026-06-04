/**
 * Internal event → standing signals (stage-7-reputation.md § What gets
 * tracked). Each event maps to zero, one or two signals — never any
 * branching on prior escrow state (that's why refund_expired and
 * reclaim_abandoned are separate events).
 *
 * Reputation deliberately ignores escrow.created / accepted /
 * proof_submitted / dispute_raised — they carry no signal.
 */

import type { StandingEventKind } from '@tenda/shared/db/schema/reputation'
import type { InternalEscrowEvent } from '@server/lib/escrow-events'

export interface EscrowParties {
  creator_id: string
  counterparty_id: string | null
}

export interface StandingSignal {
  user_id: string
  kind: StandingEventKind
  role: 'creator' | 'counterparty'
}

export interface SignalContext {
  parties: EscrowParties
  /** DisputeResolved only: who won + who raised. */
  dispute?: { winner: 'creator' | 'counterparty' | 'split'; raised_by: string }
}

/**
 * Pure mapping. Returns the signals to record; an empty array means the
 * event is reputation-neutral.
 */
export function signalsFor(event: InternalEscrowEvent, ctx: SignalContext): StandingSignal[] {
  const { creator_id, counterparty_id } = ctx.parties
  switch (event) {
    case 'escrow.approved':
      // Both sides completed cleanly.
      return withCounterparty(counterparty_id, (cp) => [
        { user_id: creator_id, kind: 'completed', role: 'creator' },
        { user_id: cp, kind: 'completed', role: 'counterparty' },
      ])
    case 'escrow.payment_claimed':
      // Work was paid out, but the creator ghosted the approval.
      return withCounterparty(counterparty_id, (cp) => [
        { user_id: cp, kind: 'completed', role: 'counterparty' },
        { user_id: creator_id, kind: 'ghosted_approval', role: 'creator' },
      ])
    case 'escrow.abandoned':
      return withCounterparty(counterparty_id, (cp) => [
        { user_id: cp, kind: 'abandoned', role: 'counterparty' },
      ])
    case 'escrow.declined':
      // Neutral by design (workers should decline rather than abandon),
      // and the assignee never became the counterparty — there is no
      // reliable user id on the escrow row to record against. No signal.
      return []
    case 'escrow.cancelled':
      return [{ user_id: creator_id, kind: 'cancelled', role: 'creator' }]
    case 'escrow.dispute_resolved': {
      if (ctx.dispute === undefined) return []
      const { winner } = ctx.dispute
      if (winner === 'split') return [] // no behavioural fault assigned
      return withCounterparty(counterparty_id, (cp) =>
        winner === 'creator'
          ? [
              { user_id: creator_id, kind: 'disputed_won', role: 'creator' },
              { user_id: cp, kind: 'disputed_lost', role: 'counterparty' },
            ]
          : [
              { user_id: cp, kind: 'disputed_won', role: 'counterparty' },
              { user_id: creator_id, kind: 'disputed_lost', role: 'creator' },
            ],
      )
    }
    case 'escrow.created':
    case 'escrow.accepted':
    case 'escrow.proof_submitted':
    case 'escrow.dispute_raised':
    case 'escrow.expired':
      // Expired = nobody accepted; no counterparty existed → no signal.
      return []
  }
}

function withCounterparty(
  counterparty_id: string | null,
  build: (cp: string) => StandingSignal[],
): StandingSignal[] {
  return counterparty_id === null ? [] : build(counterparty_id)
}
