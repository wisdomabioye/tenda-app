/**
 * Per-event application table: one declarative entry per on-chain event —
 * which `escrow_transactions.type` it records, which prior statuses are legal
 * (the status guard), which decoded fields carry amount/fee/actor, and the
 * column patch it stamps. Decoded payloads come from the chain; the
 * webhook/client hint is never the source of truth. Internal event names are
 * republished in snake_case (stage-2 table).
 */

import type { EscrowEvent } from '@server/chains/types'
import type { EscrowTxType } from '@tenda/shared'
import type { EscrowStatus } from '@server/lib/escrow'
import type { EscrowPatch } from './store'

export const INTERNAL_EVENT_BY_WIRE = {
  EscrowCreated: 'escrow.created',
  EscrowAccepted: 'escrow.accepted',
  EscrowDeclined: 'escrow.declined',
  ProofSubmitted: 'escrow.proof_submitted',
  EscrowApproved: 'escrow.approved',
  PaymentClaimed: 'escrow.payment_claimed',
  EscrowCancelled: 'escrow.cancelled',
  EscrowExpired: 'escrow.expired',
  EscrowAbandoned: 'escrow.abandoned',
  DisputeRaised: 'escrow.dispute_raised',
  DisputeResolved: 'escrow.dispute_resolved',
} as const satisfies Record<EscrowEvent, string>

export type InternalEscrowEvent = (typeof INTERNAL_EVENT_BY_WIRE)[EscrowEvent]

export interface EventApplication {
  tx_type: EscrowTxType
  /** Legal prior statuses — the status guard. */
  from: EscrowStatus[]
  /** Field name carrying the settled amount, if any. */
  amount_field?: string
  /** Field name carrying the platform fee, if any. */
  fee_field?: string
  /** Field naming the acting wallet (resolved to actor_id), if any. */
  actor_field?: string
  /** Build the column patch from decoded fields. */
  patch(fields: Record<string, string>): EscrowPatch
}

function unixField(fields: Record<string, string>, name: string): Date {
  return new Date(Number(fields[name]) * 1000)
}

export const EVENT_APPLICATIONS: Record<EscrowEvent, EventApplication> = {
  EscrowCreated: {
    tx_type: 'create',
    from: ['draft'],
    amount_field: 'amount',
    actor_field: 'creator',
    patch: () => ({ status: 'open' }),
  },
  EscrowAccepted: {
    tx_type: 'accept',
    from: ['open'],
    actor_field: 'counterparty',
    patch: (f) => ({
      status: 'accepted',
      completion_deadline: unixField(f, 'completion_deadline'),
    }),
  },
  EscrowDeclined: {
    tx_type: 'decline',
    from: ['open'],
    actor_field: 'declined_by',
    // Status stays open — the decline clears the assignment only.
    patch: () => ({ assigned_counterparty_id: null }),
  },
  ProofSubmitted: {
    tx_type: 'submit',
    from: ['accepted'],
    actor_field: 'counterparty',
    patch: (f) => ({
      status: 'submitted',
      submitted_at: unixField(f, 'timestamp'),
      approval_deadline: unixField(f, 'approval_deadline'),
    }),
  },
  EscrowApproved: {
    tx_type: 'approve',
    from: ['submitted'],
    amount_field: 'amount',
    fee_field: 'platform_fee',
    actor_field: 'creator',
    patch: () => ({ status: 'completed' }),
  },
  PaymentClaimed: {
    tx_type: 'claim_stalled',
    from: ['submitted'],
    amount_field: 'amount',
    fee_field: 'platform_fee',
    actor_field: 'counterparty',
    patch: () => ({ status: 'completed' }),
  },
  EscrowCancelled: {
    tx_type: 'cancel',
    from: ['open'],
    amount_field: 'refund_amount',
    actor_field: 'creator',
    patch: () => ({ status: 'cancelled' }),
  },
  EscrowExpired: {
    tx_type: 'refund_expired',
    from: ['open'],
    amount_field: 'refund_amount',
    actor_field: 'creator',
    patch: () => ({ status: 'refunded' }),
  },
  EscrowAbandoned: {
    tx_type: 'reclaim_abandoned',
    from: ['accepted'],
    amount_field: 'refund_amount',
    actor_field: 'creator',
    patch: () => ({ status: 'refunded' }),
  },
  DisputeRaised: {
    tx_type: 'dispute',
    from: ['accepted', 'submitted'],
    amount_field: 'bond_amount',
    actor_field: 'raised_by',
    patch: () => ({ status: 'disputed' }),
  },
  DisputeResolved: {
    tx_type: 'resolve',
    from: ['disputed'],
    fee_field: 'platform_fee',
    patch: () => ({ status: 'resolved' }),
  },
}
