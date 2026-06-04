/**
 * BullMQ + Redis queue plugin. Stage 0 ships a **typed surface only** —
 * the BullMQ + ioredis dependency add and connection wiring land alongside
 * #33 (Redis provisioning). Until then, `fastify.queue.enqueue(...)` throws
 * `INTERNAL_ERROR` so call sites fail loud instead of silently dropping jobs.
 *
 * Spec (stage-0-foundation.md § Infrastructure):
 *   - `notifications`  — push fan-out
 *   - `expire-escrows` — repeatable job (every 60s)
 *   - `verify-tx`      — Stage 2 producer (class exists; no producers yet)
 *   - `reconcile`      — Stage 2 placeholder
 *
 * Adding a new queue: add the variant to `JobName` + matching payload to
 * `JobPayload`. TypeScript exhaustiveness ensures callers can't enqueue an
 * unknown queue.
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import type { VerifyTxJobPayload } from '@server/jobs/verify-tx'

// ---------- public surface ----------------------------------------------

export type JobName = 'notifications' | 'expire-escrows' | 'verify-tx' | 'reconcile'

/**
 * Per-queue payload shapes. Stage 0 freezes the surface; #33 implementer
 * wires BullMQ workers consuming these exact shapes.
 */
export interface JobPayload {
  notifications: {
    /**
     * Recipient user — the delivery worker resolves device tokens at send
     * time (tokens churn between enqueue and delivery; resolving early
     * would push to stale devices).
     */
    user_id: string
    title: string
    body: string
    data?: Record<string, string>
  }
  'expire-escrows': {
    /** Tick id for log correlation. Cron writer sets `Date.now().toString()`. */
    tick_id: string
  }
  /** Imported from `jobs/verify-tx.ts` so producer + handler share one shape. */
  'verify-tx': VerifyTxJobPayload
  reconcile: {
    /** Window start (inclusive) ISO-8601. */
    from_iso: string
    /** Window end (exclusive) ISO-8601. */
    to_iso: string
  }
}

export interface EnqueueOptions {
  /** Idempotency key — BullMQ `jobId`. Same id de-dups across enqueues. */
  job_id?: string
  /** Delay before the job becomes available, in milliseconds. */
  delay_ms?: number
  /** Max retry attempts; defaults defined by #33 worker config. */
  attempts?: number
}

export interface QueueService {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload[N],
    opts?: EnqueueOptions,
  ): Promise<{ job_id: string }>
}

// ---------- plugin -------------------------------------------------------

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  const queue: QueueService = {
    async enqueue(name, _payload, _opts) {
      throw new AppError(
        501,
        ErrorCode.INTERNAL_ERROR,
        `queue.enqueue('${name}'): BullMQ not provisioned — lands with #33 (Redis provisioning)`,
      )
    },
  }
  fastify.decorate('queue', queue)
}

export default fp(queuePlugin, { name: 'queue' })
