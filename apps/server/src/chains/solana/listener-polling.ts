/**
 * Self-hosted polling listener (stage-2-listeners.md): the fallback that runs
 * when the Solana chain's WEBHOOK_SECRET is unset (Helius down or unconfigured).
 *
 * The ONLY consumer of `chain_cursors` (webhooks are push-based and dedup
 * via job ids). Each tick fetches recent program signatures, enqueues
 * idempotent verify-tx jobs for those in slots beyond the cursor, then
 * advances the cursor to the highest slot seen.
 *
 * Cursor boundary: signatures landing later in the SAME slot as the cursor
 * can be skipped by the strict `slot > cursor` filter, accepted, because
 * the reconciliation sweep catches anything a tick misses (defence in
 * depth is the design, not single-pass perfection).
 */

import { PROGRAM_ID } from '@server/chains/solana/pdas'
import type { SolanaRpc } from '@server/chains/solana/rpc'
import type { ChainId, ChainListener } from '@server/chains/types'
import type { QueueService } from '@server/plugins/queue'
import { verifyTxDedupKey } from '@server/jobs/verify-tx'

// ---------- policy constants ---------------------------------------------

export const POLL_INTERVAL_MS = 15_000
export const POLL_SIGNATURE_LIMIT = 100

// ---------- cursor store seam ----------------------------------------------

export interface CursorStore {
  /** Last processed slot for the chain; 0 when no cursor exists yet. */
  getCursor(chain_id: ChainId): Promise<number>
  setCursor(chain_id: ChainId, slot: number): Promise<void>
}

// ---------- tick (the testable unit) -----------------------------------------

export interface PollTickDeps {
  rpc: SolanaRpc
  chain_id: ChainId
  cursors: CursorStore
  queue: Pick<QueueService, 'enqueue'>
  log: {
    info(obj: Record<string, unknown>, msg: string): void
    warn(obj: Record<string, unknown>, msg: string): void
  }
}

export interface PollTickResult {
  fetched: number
  enqueued: number
  cursor: number
}

export async function pollTick(deps: PollTickDeps): Promise<PollTickResult> {
  const cursor = await deps.cursors.getCursor(deps.chain_id)
  const signatures = await deps.rpc.getSignaturesForAddress(PROGRAM_ID.toBase58(), {
    limit: POLL_SIGNATURE_LIMIT,
  })

  const fresh = signatures.filter((s) => s.slot > cursor)
  let enqueued = 0
  // Oldest first so a mid-batch failure leaves the cursor behind the gap.
  for (const s of [...fresh].sort((a, b) => a.slot - b.slot)) {
    try {
      await deps.queue.enqueue(
        'verify-tx',
        { chain_id: deps.chain_id, tx_ref: s.signature, source: 'polling' },
        {
          job_id: verifyTxDedupKey({
            chain_id: deps.chain_id,
            tx_ref: s.signature,
            event: 'Any',
          }),
        },
      )
      enqueued += 1
    } catch (err) {
      // Queue down: stop the tick WITHOUT advancing the cursor past this
      // signature, the next tick retries from here.
      deps.log.warn({ err, signature: s.signature }, 'polling: enqueue failed, tick aborted')
      const lastGood = s.slot - 1
      if (lastGood > cursor) await deps.cursors.setCursor(deps.chain_id, lastGood)
      return { fetched: signatures.length, enqueued, cursor: Math.max(cursor, lastGood) }
    }
  }

  const maxSlot = fresh.reduce((m, s) => Math.max(m, s.slot), cursor)
  if (maxSlot > cursor) await deps.cursors.setCursor(deps.chain_id, maxSlot)
  return { fetched: signatures.length, enqueued, cursor: maxSlot }
}

// ---------- listener -----------------------------------------------------------

export function createSolanaPollingListener(
  deps: PollTickDeps & { interval_ms?: number },
): ChainListener {
  let timer: NodeJS.Timeout | null = null
  let running = false

  return {
    async start() {
      const interval = deps.interval_ms ?? POLL_INTERVAL_MS
      timer = setInterval(() => {
        if (running) return // skip overlapping ticks
        running = true
        pollTick(deps)
          .catch((err) => deps.log.warn({ err }, 'polling tick failed'))
          .finally(() => {
            running = false
          })
      }, interval)
      timer.unref()
      deps.log.info({ interval_ms: interval, chain_id: deps.chain_id }, 'polling listener started')
    },
    async stop() {
      if (timer !== null) clearInterval(timer)
      timer = null
    },
  }
}

// ---------- drizzle cursor store --------------------------------------------------

import { eq } from 'drizzle-orm'
import { chain_cursors } from '@tenda/shared/db/schema/ops'
import type { AppDatabase } from '@server/plugins/db'

export function drizzleCursorStore(db: AppDatabase): CursorStore {
  return {
    async getCursor(chain_id) {
      const rows = await db
        .select({ last_block: chain_cursors.last_block })
        .from(chain_cursors)
        .where(eq(chain_cursors.chain_id, chain_id))
        .limit(1)
      return rows[0]?.last_block ?? 0
    },
    async setCursor(chain_id, slot) {
      await db
        .insert(chain_cursors)
        .values({ chain_id, last_block: slot, last_processed_at: new Date() })
        .onConflictDoUpdate({
          target: chain_cursors.chain_id,
          set: { last_block: slot, last_processed_at: new Date() },
        })
    },
  }
}
