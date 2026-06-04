/**
 * On-chain event → DB application (the heart of the verify-tx pipeline,
 * stage-2-listeners.md § Verify job handler).
 *
 * One declarative entry per event: which `escrow_transactions.type` it
 * records, which prior statuses are legal (the STATUS GUARD — a concurrent
 * webhook/reconcile race applies exactly once), and which derived columns
 * the event stamps. Decoded event payloads come from the chain — the
 * webhook/client hint is never the source of truth.
 *
 * Event names are republished internally in snake_case (stage-2 table);
 * downstream consumers (notifications, WS, Stage-7 reputation, Stage-8
 * fiat) only ever see the snake_case form.
 */

import type { ChainNamespace } from '@tenda/shared/db/schema/chains'
import type { EscrowTxType } from '@tenda/shared'
import type { DecodedEvent, EscrowEvent } from '@server/chains/types'
import type { EscrowStatus } from '@server/lib/escrow'

// ---------- internal (snake_case) event names --------------------------------

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

// ---------- store seam ---------------------------------------------------------

/** Column patch applied alongside the status guard. */
export interface EscrowPatch {
  status?: EscrowStatus
  escrow_ref?: string
  counterparty_id?: string | null
  assigned_counterparty_id?: string | null
  completion_deadline?: Date
  submitted_at?: Date
  approval_deadline?: Date
}

export interface EscrowEventStore {
  /**
   * Status-guarded UPDATE: apply `patch` iff the row's status is in `from`.
   * Returns false when the guard trips (another worker already applied) —
   * the caller treats that as an idempotent no-op, not an error.
   */
  applyTransition(args: {
    escrow_id: string
    from: EscrowStatus[]
    patch: EscrowPatch
  }): Promise<boolean>
  insertTransaction(row: {
    escrow_id: string
    type: EscrowTxType
    tx_ref: string
    amount_raw: string | null
    platform_fee_raw: string | null
    actor_id: string | null
  }): Promise<void>
  /** Wallet address → user id on the namespace; null if unknown. */
  resolveUserByWallet(chain_ns: ChainNamespace, address: string): Promise<string | null>
  /** Stamp the dispute row when DisputeResolved lands. */
  recordDisputeResolution(args: {
    escrow_id: string
    winner: 'creator' | 'counterparty' | 'split'
  }): Promise<void>
}

// ---------- per-event application table --------------------------------------

interface EventApplication {
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

// ---------- apply ----------------------------------------------------------------

export interface ApplyEscrowEventDeps {
  store: EscrowEventStore
  chain_ns: ChainNamespace
}

export interface ApplyEscrowEventResult {
  /** False when the status guard tripped (already applied elsewhere). */
  applied: boolean
  escrow_id: string
  internal_event: InternalEscrowEvent
}

const WINNERS = ['creator', 'counterparty', 'split'] as const
type Winner = (typeof WINNERS)[number]

function narrowWinner(v: string | undefined): Winner | null {
  return v !== undefined && (WINNERS as readonly string[]).includes(v) ? (v as Winner) : null
}

/**
 * Apply one verified, decoded event to the DB. Idempotent two ways: the
 * status guard absorbs replays of the same logical transition, and the
 * caller's tx_ref dedup absorbs replays of the same transaction.
 */
export async function applyEscrowEvent(
  deps: ApplyEscrowEventDeps,
  event: DecodedEvent,
  tx_ref: string,
): Promise<ApplyEscrowEventResult> {
  const app = EVENT_APPLICATIONS[event.name]
  const escrow_id = event.fields.escrow_id
  if (escrow_id === undefined) {
    throw new Error(`decoded ${event.name} event is missing escrow_id`)
  }

  const patch = app.patch(event.fields)

  // EscrowCreated stamps the on-chain ref; EscrowAccepted resolves the
  // accepting wallet to a user id. Both need data beyond the static table.
  if (event.name === 'EscrowCreated') {
    patch.escrow_ref = event.escrow_ref
  }
  if (event.name === 'EscrowAccepted') {
    const address = event.fields.counterparty
    patch.counterparty_id =
      address !== undefined
        ? await deps.store.resolveUserByWallet(deps.chain_ns, address)
        : null
  }

  const applied = await deps.store.applyTransition({ escrow_id, from: app.from, patch })

  if (applied) {
    const actorAddress = app.actor_field !== undefined ? event.fields[app.actor_field] : undefined
    const actor_id =
      actorAddress !== undefined
        ? await deps.store.resolveUserByWallet(deps.chain_ns, actorAddress)
        : null
    await deps.store.insertTransaction({
      escrow_id,
      type: app.tx_type,
      tx_ref,
      amount_raw:
        app.amount_field !== undefined ? (event.fields[app.amount_field] ?? null) : null,
      platform_fee_raw: app.fee_field !== undefined ? (event.fields[app.fee_field] ?? null) : null,
      actor_id,
    })

    if (event.name === 'DisputeResolved') {
      const winner = narrowWinner(event.fields.winner)
      if (winner !== null) {
        await deps.store.recordDisputeResolution({ escrow_id, winner })
      }
    }
  }

  return { applied, escrow_id, internal_event: INTERNAL_EVENT_BY_WIRE[event.name] }
}

// ---------- drizzle store ----------------------------------------------------

// Placed here (not a separate file) per the lib convention: seam + impl
// co-located, tests use the seam.

import { and, eq, inArray } from 'drizzle-orm'
import { escrows, escrow_transactions } from '@tenda/shared/db/schema/escrow'
import { disputes } from '@tenda/shared/db/schema/governance'
import { user_wallets } from '@tenda/shared/db/schema/identity'
import type { AppDatabase } from '@server/plugins/db'

export function drizzleEscrowEventStore(db: AppDatabase): EscrowEventStore {
  return {
    async applyTransition({ escrow_id, from, patch }) {
      const updated = await db
        .update(escrows)
        .set(patch)
        .where(and(eq(escrows.id, escrow_id), inArray(escrows.status, from)))
        .returning({ id: escrows.id })
      return updated.length > 0
    },
    async insertTransaction(row) {
      // tx_ref UNIQUE — a replayed insert is a no-op (defence in depth on
      // top of the caller's isProcessed dedup).
      await db.insert(escrow_transactions).values(row).onConflictDoNothing({
        target: escrow_transactions.tx_ref,
      })
    },
    async resolveUserByWallet(chain_ns, address) {
      const rows = await db
        .select({ user_id: user_wallets.user_id })
        .from(user_wallets)
        .where(and(eq(user_wallets.chain_ns, chain_ns), eq(user_wallets.address, address)))
        .limit(1)
      return rows[0]?.user_id ?? null
    },
    async recordDisputeResolution({ escrow_id, winner }) {
      await db
        .update(disputes)
        .set({ winner, resolved_at: new Date() })
        .where(eq(disputes.escrow_id, escrow_id))
    },
  }
}
