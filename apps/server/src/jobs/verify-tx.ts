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
 *   - BullMQ jobId = `dedupKey({chain_id, tx_ref, event})` — duplicate
 *     enqueues no-op (BullMQ-level dedup).
 *   - Handler dedup: `escrow_transactions.tx_ref` UNIQUE catches anything
 *     the queue layer missed (different chain_id values, manual retries).
 */

import { eq } from 'drizzle-orm'
import { escrow_transactions } from '@tenda/shared/db/schema-v2'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import type { ChainRegistry, EscrowEvent } from '@server/chains/types'
import type { AppDatabase } from '@server/plugins/db'

// ---------- store abstraction --------------------------------------------

/**
 * Decoupled DB surface — matches the `SponsorStore` / `NonceStore` pattern
 * (see lib/sponsor.ts, lib/nonce.ts). Lets unit tests use an in-memory
 * implementation without standing up Postgres.
 */
export interface VerifyTxStore {
  /** True iff `escrow_transactions` already has a row with this tx_ref. */
  isProcessed(tx_ref: string): Promise<boolean>
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
  }
}

// ---------- payload ------------------------------------------------------

export interface VerifyTxJobPayload {
  /** CAIP-2 chain id; resolves to a `ChainAdapter` via the registry. */
  chain_id: string
  /** Solana signature (base58) or EVM tx hash (0x…). */
  tx_ref: string
  /** Event the producer expected. Cross-checked against decoded payload. */
  expected_event: EscrowEvent
  /**
   * Optional client-side hint — verified against decoded `escrow_ref`.
   * Mismatched hint is treated as fraud and logged.
   */
  escrow_id?: string
  /** Origin of the enqueue. Used for retry-strategy tuning only. */
  source: 'webhook' | 'polling' | 'client-hint' | 'reconcile'
}

// ---------- result -------------------------------------------------------

export type VerifyTxResult =
  /** `tx_ref` already settled — no work to do. */
  | { skipped: true; reason: 'already_processed' }
  /** Stage 2+ path: state applied, internal event republished. */
  | { skipped: false; event: EscrowEvent; escrow_id: string }

// ---------- retryable signal --------------------------------------------

/**
 * Thrown when the tx isn't confirmed yet — BullMQ should retry with backoff.
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
}

// ---------- idempotency key ---------------------------------------------

/**
 * BullMQ jobId factory. Spec lives in core/queue/idempotency.ts (Stage 2);
 * Stage 0 inlines the format so the queue.ts plugin's `EnqueueOptions.job_id`
 * can be populated consistently.
 *
 * Format: `verify-tx:{chain_id}:{tx_ref}:{event}` — colons are safe in
 * BullMQ jobIds, and `tx_ref` is the high-entropy component (base58 sig or
 * 0x-hex hash) so collisions across (chain, event) tuples are vanishingly
 * unlikely. Event is included because the same tx can emit multiple
 * EscrowEvent types in principle (though current contract emits one).
 */
export function verifyTxDedupKey(args: {
  chain_id: string
  tx_ref: string
  event: EscrowEvent
}): string {
  return `verify-tx:${args.chain_id}:${args.tx_ref}:${args.event}`
}

// ---------- handler ------------------------------------------------------

/**
 * Entry point for the BullMQ worker. Returns `{ skipped: true }` if the
 * tx_ref was already processed (idempotency check passes). Throws
 * `RetryableError` on transient verification failures; `AppError` for
 * permanent ones.
 *
 * Stage 0 implements: dedup check + producer-side type contract. The
 * `adapter.verifyTx → decode → transition → republish` pipeline throws 501
 * until Stage 2 wires it.
 */
export async function verifyTxJobHandler(
  deps: VerifyTxDeps,
  job: VerifyTxJobPayload,
): Promise<VerifyTxResult> {
  // Step 1 — idempotency check.
  if (await deps.store.isProcessed(job.tx_ref)) {
    return { skipped: true, reason: 'already_processed' }
  }

  // Step 2 — fetch + verify on-chain. (Adapter stubbed until #29.)
  // Wiring the adapter call now so the registry lookup is exercised even
  // before the inner verifyTx body lands.
  const adapter = deps.chains.get(job.chain_id)
  void adapter

  // Steps 3–5 land with Stage 2 (listener + event bus + WS broadcast).
  throw new AppError(
    501,
    ErrorCode.INTERNAL_ERROR,
    `verify-tx: post-dedup pipeline not implemented — lands with Stage 2 (listeners.md)`,
  )
}
