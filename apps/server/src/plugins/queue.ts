/**
 * BullMQ + Redis queue plugin — the typed producer surface. Workers and their
 * concurrency live in plugins/workers.ts, processors in workers/processors.ts;
 * both key off `JobName` from here, so this module decides what queues exist.
 *
 * Without `REDIS_URL` the plugin degrades to a stub whose `enqueue` throws
 * `INTERNAL_ERROR` (501), so call sites fail loud instead of silently dropping
 * jobs. Callers that treat enqueueing as best-effort (webhooks log + continue,
 * reconcile covers the gap) already handle that.
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
// TYPE-ONLY, and it must stay that way: features/alerts/types.ts imports
// `QueueService` back from this module, so the two reference each other. Both
// directions are erased today (verified in the emitted JS — neither file
// requires the other), but a value import on either side would close a real
// runtime cycle, and this plugin loads early enough that the alerts feature
// would be half-initialised when it did.
import type { AlertJob } from '@server/features/alerts'

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
  /**
   * Expand a new gig into one notification per matching subscriber.
   *
   * A queue of its own rather than work done inline in the verify-tx republish:
   * the expansion is unbounded in the subscriber count, and doing it inline held
   * one of only 8 verify-tx slots for its whole duration — so a popular gig
   * delayed the transaction verification that users are watching a
   * TransactionMonitor for. Carries the escrow id and nothing else; the worker
   * re-reads the gig, because the row is the source of truth for city/category
   * and copying them into the payload would let a job enqueued before an edit
   * fan out against stale matching criteria.
   */
  'fanout-subscribers': { escrow_id: string }
  /**
   * One operational alert, for ONE channel. Imported rather than re-declared so
   * the producer, this queue and `deliverAlert` cannot describe the job three
   * slightly different ways — see features/alerts/types.ts for why the fan-out
   * is per channel rather than one job that loops them.
   */
  alerts: AlertJob
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

/**
 * One job in a bulk enqueue — the same pair a single `enqueue` takes.
 *
 * Per-job `opts` rather than one set shared by the batch, because the options
 * that matter here are per-job by nature: `job_id` is an idempotency key, and a
 * batch that shared one would de-dup itself down to a single job.
 */
export interface BulkJob<N extends JobName> {
  payload: JobPayload[N]
  opts?: EnqueueOptions
}

export interface QueueService {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload[N],
    opts?: EnqueueOptions,
  ): Promise<{ job_id: string }>
  /**
   * Many jobs onto ONE queue in a single pipelined round trip.
   *
   * The cost this exists to remove is N × RTT, not CPU: against LOCAL Redis
   * (~0 RTT) 500 jobs measured 201/300/242 ms sequentially against 33/44/46 ms
   * bulk over three runs — 5–7x. The gap widens with every millisecond of real
   * network latency, because the sequential path pays the round trip once per
   * job and this pays it once.
   *
   * NOT a transaction, and the distinction is load-bearing for callers: BullMQ's
   * `addBulk` uses a Redis PIPELINE (`Job.createBulk` → `client.pipeline()`),
   * which batches round trips without atomicity. A failure part-way still
   * leaves some jobs enqueued — the same guarantee the sequential loop gave,
   * neither better nor worse. Anything needing all-or-nothing has to be settled
   * before the call, not by it.
   */
  enqueueMany<N extends JobName>(
    name: N,
    jobs: readonly BulkJob<N>[],
  ): Promise<{ job_ids: string[] }>
}

// ---------- plugin -------------------------------------------------------

/**
 * Default retry posture, verify-tx overrides per its confirmation cadence.
 *
 * Exported because a per-queue override is only meaningful RELATIVE to this —
 * `ALERT_JOB_ATTEMPTS` exists to be lower than `attempts` here, and a test that
 * pinned the literal 5 would keep passing after someone changed this to 3 and
 * made the override a no-op. Same reasoning as exporting WORKER_CONCURRENCY.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 24 * 3_600, count: 5_000 },
  // Both bounds, deliberately — age alone is not a bound.
  //
  // `age` only evicts as fast as failures ARRIVE (BullMQ evaluates retention
  // inside moveToFinished, it runs no background timer), so during the one
  // situation this retention exists for — a sustained outage: a push provider
  // down, a dead Slack webhook, an RPC rejecting everything — a week's worth
  // accumulates with no ceiling. `notifications` is where that bites: one
  // popular gig fans out to one job per subscriber, so a 50,000-subscriber gig
  // that exhausts its attempts leaves 50,000 failed job hashes in Redis from a
  // SINGLE post. Precisely when memory pressure is least welcome.
  //
  // 5,000, matching removeOnComplete because the two want the same thing (a
  // bounded finished set) and one number needs one justification: the failures
  // that pile up in an outage are all the same failure, so the 5,000th adds
  // nothing to the 50th. What is retained is for inspecting payloads and
  // re-driving, not for noticing — BullMQ emits `failed` on every attempt (the
  // worker awaits moveToFailed, which itself decides retry-or-terminal via
  // shouldRetryJob), so the handler in plugins/workers.ts has already logged
  // every one of them: `worker: job failed` at warn, or the info line for a
  // RetryableError the reconcile repeatable takes over.
  //
  // Per queue, not app-wide: BullMQ trims the queue's own `failed` zset, so the
  // real ceiling is 5,000 × the number of JobNames.
  //
  // Honest cost: count evicts OLDEST first (ZREVRANGE keeps the newest —
  // measured: 10 failures under a cap of 3 retained jobs 8, 9, 10), so an
  // outage past 5,000 loses its onset, usually the most diagnostic failure.
  // BullMQ offers no keep-oldest mode; the log lines above are what survive it.
  removeOnFail: { age: 7 * 24 * 3_600, count: 5_000 },
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

/**
 * The options EVERY `new Queue(...)` in this app is constructed with.
 *
 * A function rather than two call sites spelling out the same object literal,
 * because the two had already diverged and the divergence put the retention
 * above out of reach of the queues that tick forever. plugins/workers.ts
 * builds a Queue per repeatable to register its scheduler and passed
 * `{ connection }` alone — so every tick those schedulers produce carried NO
 * retention at all (BullMQ merges the registering queue's `defaultJobOptions`
 * into the scheduler template, and undefined there means keep forever).
 * Measured against real Redis: with a bare `{ connection }`, nothing was ever
 * trimmed — waiting on 8 scheduler-produced completions left 11 completed
 * hashes behind (the scheduler kept firing while the probe settled) and every
 * job carried `opts.removeOnComplete: undefined`. The same probe with these
 * options held at the cap. REPEATABLES runs three schedulers every 60s and two
 * every 5min, so that is ~4,900 completed job hashes a day, accumulating for
 * the life of the deployment. Not a bigger number than the uncapped
 * `removeOnFail` this task set out to close — an outage can out-produce it in
 * minutes — but a worse shape: that one needed something to go wrong and
 * stopped when it was fixed, this one ran on a healthy system and never
 * stopped. Sitting one file away from the constant meant to bound it.
 *
 * Guarded by a source scan in test/unit/queue.test.ts rather than by review: a
 * bare `new Queue(name, { connection })` compiles, runs, and passes every
 * behavioural test, because nothing about it is wrong except what Redis keeps.
 */
export function queueOptions(connection: QueueConnectionOptions): {
  connection: QueueConnectionOptions
  defaultJobOptions: typeof DEFAULT_JOB_OPTIONS
} {
  return { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }
}

/**
 * The subset of BullMQ's `JobsOptions` this app sets — declared rather than
 * imported so the mapping below has a return type that changes only when we
 * decide it does, not when BullMQ widens its own.
 */
export interface BullJobOptions {
  jobId?: string
  delay?: number
  attempts?: number
  removeOnComplete?: boolean
}

/**
 * `EnqueueOptions` → BullMQ's `JobsOptions`, in ONE place.
 *
 * Both producer paths map the same four fields, and a second copy is how
 * `remove_on_complete` ends up honoured by single enqueues and quietly dropped
 * by bulk ones — a divergence that leaks a `send-otp` code into completed-job
 * history and fails no test.
 *
 * Exported for the same reason `queueConnectionOptions` is: it is a pure
 * function on the live path, and the live path needs Redis. Without this it
 * would be reachable only from a Redis-backed test — which CI does not run — so
 * dropping a field here would fail nothing.
 */
export function toJobOptions(opts?: EnqueueOptions): BullJobOptions {
  return {
    ...(opts?.job_id !== undefined ? { jobId: opts.job_id } : {}),
    ...(opts?.delay_ms !== undefined ? { delay: opts.delay_ms } : {}),
    ...(opts?.attempts !== undefined ? { attempts: opts.attempts } : {}),
    ...(opts?.remove_on_complete !== undefined
      ? { removeOnComplete: opts.remove_on_complete }
      : {}),
  }
}

/**
 * The id BullMQ assigned, or the one the caller asked for, or an admission that
 * we do not know.
 *
 * Both producer paths need this three-step fallback, and two copies of it drift
 * the same way `toJobOptions` would: someone changes the sentinel in one and a
 * log line starts saying something different depending on which path ran.
 * `job.id` is optional on BullMQ's `Job`, which is why there is a fallback at
 * all.
 */
function resolveJobId(id: string | undefined, opts?: EnqueueOptions): string {
  return id ?? opts?.job_id ?? 'unknown'
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
      // Mirrors `enqueue`: any call is a call that needed Redis. Producers with
      // nothing to send return before they get here — `enqueueNotificationToMany`
      // does exactly that — so this stays a loud failure rather than a
      // conditional one.
      async enqueueMany(name, _jobs) {
        throw new AppError(
          501,
          ErrorCode.INTERNAL_ERROR,
          `queue.enqueueMany('${name}'): REDIS_URL not configured`,
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
      q = new Queue(queueName(name), queueOptions(connection))
      queues.set(name, q)
    }
    return q
  }

  const queue: QueueService = {
    async enqueue(name, payload, opts) {
      const job = await queueFor(name).add(name, payload, toJobOptions(opts))
      return { job_id: resolveJobId(job.id, opts) }
    },
    async enqueueMany(name, jobs) {
      // Today's only caller returns before it gets here with nothing to send
      // (lib/notify.ts), so this is defence rather than a live path — but it is
      // the cheap kind: `addBulk([])` is a Redis round trip whose only possible
      // answer is [], and skipping it also avoids constructing the Queue (and
      // its connection) for a call that enqueues nothing.
      if (jobs.length === 0) return { job_ids: [] }
      const added = await queueFor(name).addBulk(
        jobs.map((job) => ({ name, data: job.payload, opts: toJobOptions(job.opts) })),
      )
      // `added` is index-aligned with `jobs` (BullMQ builds its instances by
      // mapping the input in order), so the fallback can name the id THIS job
      // asked for rather than some other job's.
      return { job_ids: added.map((job, i) => resolveJobId(job.id, jobs[i].opts)) }
    },
  }
  fastify.decorate('queue', queue)

  fastify.addHook('onClose', async () => {
    await Promise.allSettled([...queues.values()].map((q) => q.close()))
  })
}

export default fp(queuePlugin, { name: 'queue' })
