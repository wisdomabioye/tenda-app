/**
 * BullMQ + Redis queue plugin. Stage 0 ships a **typed surface only**,
 * the BullMQ + ioredis dependency add and connection wiring land alongside
 * #33 (Redis provisioning). Until then, `fastify.queue.enqueue(...)` throws
 * `INTERNAL_ERROR` so call sites fail loud instead of silently dropping jobs.
 *
 * Spec (stage-0-foundation.md § Infrastructure):
 *   - `notifications` , push fan-out
 *   - `expire-escrows`, repeatable job (every 60s)
 *   - `verify-tx`     , Stage 2 producer (class exists; no producers yet)
 *   - `reconcile`     , Stage 2 placeholder
 *
 * Adding a new queue: add ONE entry to `JobPayload`. `JobName` derives from
 * it, so the name, the worker concurrency map and the processor map all fail
 * to compile until they account for it. TypeScript exhaustiveness ensures
 * callers can't enqueue an unknown queue.
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { Queue } from 'bullmq'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { getConfig } from '@server/config'
import type { VerifyTxJobPayload } from '@server/jobs/verify-tx'
import type { OtpMessage } from '@server/lib/otp'

// ---------- public surface ----------------------------------------------

/**
 * Every queue this app runs — DERIVED from `JobPayload`, never hand-listed.
 *
 * These were two independent declarations, so a queue added to one and not the
 * other still compiled: a payload with no name is unreachable, and a name with
 * no payload gets a `WORKER_CONCURRENCY` entry and a processor but no way to
 * describe what it carries. Deriving makes the payload map the single source
 * and turns "add a queue" into one edit. Type aliases are hoisted, so the
 * forward reference to the interface below is fine.
 */
export type JobName = keyof JobPayload

/**
 * Per-queue payload shapes. Stage 0 freezes the surface; #33 implementer
 * wires BullMQ workers consuming these exact shapes.
 */
export interface JobPayload {
  notifications: {
    /**
     * Stable notification id, stamped at enqueue by `enqueueNotification`. The
     * delivery worker inserts with onConflictDoNothing so persistence is
     * idempotent across BullMQ retries (this queue runs `attempts: 5`).
     */
    id: string
    /**
     * Recipient user, the delivery worker resolves device tokens at send
     * time (tokens churn between enqueue and delivery; resolving early
     * would push to stale devices).
     */
    user_id: string
    title: string
    body: string
    data?: Record<string, string>
    /**
     * Persist to the in-app notification centre + WS-broadcast. false for chat
     * (it has its own read surface); true for every escrow/review/fiat/gig
     * notice. Always set by `enqueueNotification`.
     */
    persist: boolean
  }
  'expire-escrows': {
    /** Tick id for log correlation. Cron writer sets `Date.now().toString()`. */
    tick_id: string
  }
  'expire-applications': {
    tick_id: string
  }
  /** Imported from `jobs/verify-tx.ts` so producer + handler share one shape. */
  'verify-tx': VerifyTxJobPayload
  reconcile: {
    /**
     * Optional log-correlation window. The handler derives its real scan
     * window from its injected clock, repeatable jobs carry a static
     * payload, so these can't be fresh per tick.
     */
    from_iso?: string
    to_iso?: string
  }
  /** Stage-8 repeatables, tick id for log correlation. */
  'reconcile-fiat': { tick_id: string }
  'expire-fiat-quotes': { tick_id: string }
  /**
   * Decoupled OTP delivery, the auth challenge persists the code then enqueues
   * this so the response never blocks on the email/SMS provider. Carries the
   * plaintext code (short-lived; removed on completion via `remove_on_complete`).
   */
  'send-otp': OtpMessage
  /** Nightly category_price_stats rollup (stage-6), tick id for log correlation. */
  'update-price-stats': { tick_id: string }
  /** Daily retention sweep of stale personal notifications, tick id for correlation. */
  'prune-notifications': { tick_id: string }
}

export interface EnqueueOptions {
  /** Idempotency key, BullMQ `jobId`. Same id de-dups across enqueues. */
  job_id?: string
  /** Delay before the job becomes available, in milliseconds. */
  delay_ms?: number
  /** Max retry attempts; defaults defined by #33 worker config. */
  attempts?: number
  /**
   * Drop the job from Redis the moment it completes, overriding the queue's
   * default retention. Set for jobs whose payload carries a secret (e.g.
   * `send-otp`'s plaintext code) so it doesn't linger in completed-job history.
   */
  remove_on_complete?: boolean
}

export interface QueueService {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload[N],
    opts?: EnqueueOptions,
  ): Promise<{ job_id: string }>
}

// ---------- plugin -------------------------------------------------------

/** Default retry posture, verify-tx overrides per its confirmation cadence. */
const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 24 * 3_600, count: 5_000 },
  removeOnFail: { age: 7 * 24 * 3_600 },
}

/** Queue name prefix so several apps can share one Redis safely.
 *  NB: BullMQ forbids ':' in queue names (its own key separator). */
export const QUEUE_PREFIX = 'tenda'

export function queueName(name: JobName): string {
  return `${QUEUE_PREFIX}.${name}`
}

export interface QueueConnectionOptions {
  host: string
  port: number
  password?: string
  db?: number
  /** BullMQ requirement for blocking commands. */
  maxRetriesPerRequest: null
}

/** Parse REDIS_URL into BullMQ connection options (each Queue/Worker owns
 *  its client, no shared-instance type coupling to a specific ioredis). */
export function queueConnectionOptions(redis_url: string): QueueConnectionOptions {
  const u = new URL(redis_url)
  return {
    host: u.hostname,
    port: u.port === '' ? 6379 : Number(u.port),
    ...(u.password !== '' ? { password: u.password } : {}),
    ...(u.pathname.length > 1 ? { db: Number(u.pathname.slice(1)) } : {}),
    maxRetriesPerRequest: null,
  }
}

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  const { REDIS_URL } = getConfig()

  if (REDIS_URL === null) {
    // Degrade exactly as before #33: enqueue 501s; callers already treat
    // it as best-effort (webhooks log + continue, reconcile covers).
    const stub: QueueService = {
      async enqueue(name, _payload, _opts) {
        throw new AppError(
          501,
          ErrorCode.INTERNAL_ERROR,
          `queue.enqueue('${name}'): REDIS_URL not configured`,
        )
      },
    }
    fastify.decorate('queue', stub)
    return
  }

  const connection = queueConnectionOptions(REDIS_URL)
  const queues = new Map<JobName, Queue>()

  function queueFor(name: JobName): Queue {
    let q = queues.get(name)
    if (q === undefined) {
      q = new Queue(queueName(name), { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })
      queues.set(name, q)
    }
    return q
  }

  const queue: QueueService = {
    async enqueue(name, payload, opts) {
      const job = await queueFor(name).add(name, payload, {
        ...(opts?.job_id !== undefined ? { jobId: opts.job_id } : {}),
        ...(opts?.delay_ms !== undefined ? { delay: opts.delay_ms } : {}),
        ...(opts?.attempts !== undefined ? { attempts: opts.attempts } : {}),
        ...(opts?.remove_on_complete !== undefined
          ? { removeOnComplete: opts.remove_on_complete }
          : {}),
      })
      return { job_id: job.id ?? opts?.job_id ?? 'unknown' }
    },
  }
  fastify.decorate('queue', queue)

  fastify.addHook('onClose', async () => {
    await Promise.allSettled([...queues.values()].map((q) => q.close()))
  })
}

export default fp(queuePlugin, { name: 'queue' })
