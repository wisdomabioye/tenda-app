/**
 * verify-tx BullMQ worker. Stage 0 ships the **handler skeleton + dedup
 * key**; producers (Helius webhook, polling, reconcile) land in Stage 2.
 *
 * Lifecycle the worker must implement (per stage-2-listeners.md L154):
 *   1. Dedup: `SELECT … FROM escrow_transactions WHERE tx_ref = $1` → skip.
 *   2. `adapter.verifyTx(tx_ref, { expected_event })`. Not-confirmed-yet
 *      throws `RetryableError` so BullMQ retries with backoff.
 *   3. Decode event payload (escrow_ref, actor, amount, …).
 *   4. Apply state transition inside a single `db.transaction`, status-guarded
 *      so a concurrent reconcile-driven retry can't double-apply.
 *   5. Republish event onto the internal bus (notifications, WS broadcast).
 *
 * Stage 0 implements step 1 + the surrounding skeleton; steps 2–5 land with
 * #29 (Anchor IDL decode) + Stage 2 (event bus + WS). The skeleton throws
 * `INTERNAL_ERROR(501)` past step 1 so it fails loud rather than silently
 * marking a tx confirmed without applying state.
 *
 * Idempotency:
 *   - BullMQ jobId = `dedupKey({chain_id, tx_ref, event})`, duplicate
 *     enqueues no-op (BullMQ-level dedup).
 *   - Handler dedup: `escrow_transactions.tx_ref` UNIQUE catches anything
 *     the queue layer missed (different chain_id values, manual retries).
 */

import { eq } from 'drizzle-orm'
import { escrow_transactions, tx_attempts } from '@tenda/shared/db/schema'
import type { ChainRegistry, EscrowEvent } from '@server/chains/types'
import type { AppDatabase } from '@server/plugins/db'
import {
  applyEscrowEvent,
  type EscrowEventStore,
  type EscrowRepublishEvent,
  type InternalEscrowEvent,
} from '@server/lib/escrow-events'

// ---------- store abstraction --------------------------------------------

/**
 * Decoupled DB surface, matches the `SponsorStore` / `NonceStore` pattern
 * (see lib/sponsor.ts, lib/nonce.ts). Lets unit tests use an in-memory
 * implementation without standing up Postgres.
 */
export interface VerifyTxStore {
  /** True iff `escrow_transactions` already has a row with this tx_ref. */
  isProcessed(tx_ref: string): Promise<boolean>
  /** Stamp tx_attempts.confirmed_at (no-op if no attempt row exists). */
  markAttemptConfirmed(tx_ref: string): Promise<void>
  /**
   * Stamp tx_attempts.failed_at + failure_code (no-op if no row).
   * Stage-3 note: when the BASE paymaster lands (#45), failed SPONSORED
   * attempts (was_sponsored) must also restore the user's
   * sponsored_tx_remaining via lib/sponsor.ts, the column exists for
   * exactly that; Solana has no sponsored txs so nothing restores today.
   */
  markAttemptFailed(tx_ref: string, failure_code: string): Promise<void>
}

export function drizzleVerifyTxStore(db: AppDatabase): VerifyTxStore {
  return {
    async isProcessed(tx_ref) {
      const rows = await db
        .select({ id: escrow_transactions.id })
        .from(escrow_transactions)
        .where(eq(escrow_transactions.tx_ref, tx_ref))
        .limit(1)
      return rows.length > 0
    },
    async markAttemptConfirmed(tx_ref) {
      await db
        .update(tx_attempts)
        .set({ confirmed_at: new Date() })
        .where(eq(tx_attempts.tx_ref, tx_ref))
    },
    async markAttemptFailed(tx_ref, failure_code) {
      await db
        .update(tx_attempts)
        .set({ failed_at: new Date(), failure_code })
        .where(eq(tx_attempts.tx_ref, tx_ref))
    },
  }
}

// ---------- payload ------------------------------------------------------

export interface VerifyTxJobPayload {
  /** CAIP-2 chain id; resolves to a `ChainAdapter` via the registry. */
  chain_id: string
  /** Solana signature (base58) or EVM tx hash (0x…). */
  tx_ref: string
  /**
   * Event the producer expected, cross-checked against the decoded
   * payload. Webhook/polling producers omit it (they only know a signature
   * touched the program); the adapter then matches any escrow event.
   */
  expected_event?: EscrowEvent
  /**
   * Optional client-side hint, verified against decoded `escrow_ref`.
   * Mismatched hint is treated as fraud and logged.
   */
  escrow_id?: string
  /** Origin of the enqueue. Used for retry-strategy tuning only. */
  source: 'webhook' | 'polling' | 'client-hint' | 'reconcile'
}

// ---------- result -------------------------------------------------------

export type VerifyTxResult =
  /** `tx_ref` already settled, or not an escrow tx, no work to do. */
  | { skipped: true; reason: 'already_processed' | 'not_an_escrow_tx' }
  /** Tx confirmed but execution failed / event mismatched, terminal. */
  | { skipped: false; failed: true; reason: string }
  /** State applied (or guard-absorbed) and internal event republished. */
  | {
      skipped: false
      failed: false
      event: EscrowEvent
      internal_event: InternalEscrowEvent
      escrow_id: string
      /** False when the status guard tripped (another worker won the race). */
      applied: boolean
    }

// ---------- retryable signal --------------------------------------------

/**
 * Thrown when the tx isn't confirmed yet, BullMQ should retry with backoff.
 * Distinct from `AppError` so the worker config can branch on it (retry
 * vs dead-letter). Has no HTTP semantics; never thrown from a route.
 */
export class RetryableError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'RetryableError'
  }
}

// ---------- handler deps -------------------------------------------------

export interface VerifyTxDeps {
  store: VerifyTxStore
  chains: ChainRegistry
  eventStore: EscrowEventStore
  /**
   * Republish seam. The worker wiring (#33) hooks `fanOutEscrowEvent`
   * (workers/escrow-fanout) here, and that module owns WHICH surfaces the
   * event reaches — naming them here was a list that went stale the first
   * time one was added. Best-effort: a republish failure must not fail the
   * (already-applied) state transition.
   *
   * The payload shape is owned by lib/escrow-events (see EscrowRepublishEvent)
   * so this side and the fan-out cannot drift as fields are added.
   */
  republish(event: EscrowRepublishEvent): Promise<void>
  log: { warn(obj: Record<string, unknown>, msg: string): void }
}

// ---------- idempotency key ---------------------------------------------

/**
 * BullMQ jobId factory. Spec lives in core/queue/idempotency.ts (Stage 2);
 * Stage 0 inlines the format so the queue.ts plugin's `EnqueueOptions.job_id`
 * can be populated consistently.
 *
 * Format: `verify-tx.{chain_id}.{tx_ref}.{event}` with ':' stripped, BullMQ
 * rejects a jobId containing ':' (its Redis key separator) and CAIP-2 chain
 * ids carry one. `tx_ref` is the high-entropy component (base58 sig or
 * 0x-hex hash) so collisions across (chain, event) tuples are vanishingly
 * unlikely. Event is included because the same tx can emit multiple
 * EscrowEvent types in principle (though current contract emits one).
 */
export function verifyTxDedupKey(args: {
  chain_id: string
  tx_ref: string
  /** Producers without an expectation (webhook/polling) pass 'Any'. */
  event: EscrowEvent | 'Any'
}): string {
  // BullMQ uses ':' as its Redis key separator and rejects any custom jobId
  // containing it; CAIP-2 chain ids (e.g. 'solana:devnet') carry one. Join
  // with '.' and strip ':' from every part so the id stays BullMQ-safe and
  // deterministic. ':' is the ONLY reserved char in the inputs, so swapping
  // it for '.' can't collide (no part otherwise contains '.').
  return ['verify-tx', args.chain_id, args.tx_ref, args.event]
    .join('.')
    .replaceAll(':', '.')
}

// ---------- handler ------------------------------------------------------

/**
 * Entry point for the BullMQ worker (stage-2-listeners.md § Verify job
 * handler). Returns `{ skipped: true }` if the tx_ref was already
 * processed. Throws `RetryableError` when the tx isn't confirmed yet,
 * BullMQ retries with backoff; everything else is terminal.
 */
export async function verifyTxJobHandler(
  deps: VerifyTxDeps,
  job: VerifyTxJobPayload,
): Promise<VerifyTxResult> {
  // Step 1, idempotency check.
  if (await deps.store.isProcessed(job.tx_ref)) {
    return { skipped: true, reason: 'already_processed' }
  }

  // Step 2, fetch + verify on-chain; decode the event. The decoded
  // payload is the source of truth, the producer's hints are only
  // cross-checked inside the adapter.
  const adapter = deps.chains.get(job.chain_id)
  const verified = await adapter.verifyTx(job.tx_ref, {
    ...(job.expected_event !== undefined ? { expected_event: job.expected_event } : {}),
    ...(job.escrow_id !== undefined ? { escrow_id: job.escrow_id } : {}),
  })

  if (!verified.confirmed) {
    throw new RetryableError(verified.reason ?? 'not_yet_confirmed')
  }
  // Confirmed but not an escrow state-change (program upgrade / IDL write /
  // unrelated tx picked up by the wide-net polling feed). Terminal + inert:
  // record no failed attempt, apply nothing.
  if ('irrelevant' in verified) {
    return { skipped: true, reason: 'not_an_escrow_tx' }
  }
  if (verified.failed) {
    await deps.store.markAttemptFailed(job.tx_ref, 'TX_FAILED')
    return { skipped: false, failed: true, reason: verified.reason }
  }

  // Steps 3+4, status-guarded transition + escrow_transactions audit row.
  const result = await applyEscrowEvent(
    { store: deps.eventStore, chain_ns: adapter.namespace },
    verified.event,
    job.tx_ref,
  )
  await deps.store.markAttemptConfirmed(job.tx_ref)

  // A tripped status guard here is NOT the ordinary duplicate path: step 1
  // already short-circuited any tx_ref that was applied before, so this is a
  // genuinely new transaction whose transition did not fit the current row.
  // That means the events arrived out of order (verify-tx runs at concurrency
  // 8 with no per-escrow serialisation, so two events landing in one polling
  // tick can race) or the DB has drifted from the chain. Either way the event
  // is now dropped for good — nothing retries it, and reconcile only revisits
  // PENDING attempts. Log it so the divergence is at least observable; see the
  // reconciliation note in stage-10 for the standing gap.
  if (!result.applied) {
    deps.log.warn(
      {
        tx_ref: job.tx_ref,
        escrow_id: result.escrow_id,
        event: verified.event.name,
        source: job.source,
      },
      'verify-tx: transition skipped by the status guard on a new tx (out-of-order or drift)',
    )
  }

  // Step 5, hand the durable transition to the fan-out. Best-effort: the state
  // is already durable; a republish failure is logged, never thrown.
  if (result.applied) {
    try {
      await deps.republish({
        internal_event: result.internal_event,
        escrow_id: result.escrow_id,
        wire_event: verified.event.name,
        tx_ref: job.tx_ref,
        counterparty_id: result.counterparty_id,
        passed_applicant_ids: result.passed_applicant_ids,
        revived_applicant_ids: result.revived_applicant_ids,
      })
    } catch (err) {
      deps.log.warn(
        { err, tx_ref: job.tx_ref, escrow_id: result.escrow_id },
        'verify-tx: republish failed (state already applied)',
      )
    }
  }

  return {
    skipped: false,
    failed: false,
    event: verified.event.name,
    internal_event: result.internal_event,
    escrow_id: result.escrow_id,
    applied: result.applied,
  }
}
