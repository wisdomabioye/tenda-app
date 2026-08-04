/**
 * The queue recorder — one place that answers "what got enqueued?".
 *
 * Used directly by unit tests whose subject takes `Pick<QueueService,
 * 'enqueue'>` and nothing else, and composed by helpers/side-effects.ts, which
 * swaps this in on a live fastify instance for integration tests. Both read the
 * same `CapturedJob` shape, so an assertion written against one transfers.
 *
 * `CapturedJob` is a distributed union over `JobName`, so `payload` is narrowed
 * by checking `name` — a producer that enqueues onto the wrong queue fails to
 * type-check in the test rather than passing silently, and no reader needs a
 * cast to reach a payload field.
 */
import type { JobName, JobPayload, EnqueueOptions, QueueService } from '@server/plugins/queue'

export type CapturedJob = {
  [N in JobName]: { name: N; payload: JobPayload[N]; opts?: EnqueueOptions }
}[JobName]

/**
 * The notification payloads out of a captured list.
 *
 * `flatMap` rather than `filter().map()`: `filter` does not narrow a
 * discriminated union, so the `.map` would be reaching into a union of every
 * payload shape and would need a cast to compile.
 */
export function notificationsOf(
  calls: readonly CapturedJob[],
): JobPayload['notifications'][] {
  return calls.flatMap((c) => (c.name === 'notifications' ? [c.payload] : []))
}

/**
 * One captured alert job. Named once rather than spelled inline at the function
 * and again on the interface — two copies of a shape are two things to keep in
 * step, which is the whole reason `CapturedJob` is derived rather than listed.
 */
export interface CapturedAlert {
  payload: JobPayload['alerts']
  opts?: EnqueueOptions
}

/**
 * The alert jobs out of a captured list, with their enqueue options.
 *
 * Keeps `opts` unlike `notificationsOf`, because for this queue the options ARE
 * the subject: `job_id` is the dedup key and `attempts` the retry budget, and a
 * producer that got either wrong is indistinguishable from one that got them
 * right if only the payload is returned.
 *
 * A sibling of `notificationsOf` rather than a generic `jobsOf(calls, name)`:
 * comparing `c.name === name` does not narrow `c` while `name` is a type
 * parameter, so the generic version needs the very cast this helper's own note
 * explains how to avoid. Two four-line functions beat one that lies.
 */
export function alertsOf(calls: readonly CapturedJob[]): CapturedAlert[] {
  return calls.flatMap((c) =>
    c.name === 'alerts'
      ? [{ payload: c.payload, ...(c.opts !== undefined ? { opts: c.opts } : {}) }]
      : [],
  )
}

export interface QueueDouble extends Pick<QueueService, 'enqueue'> {
  /** Everything enqueued since construction, in order. */
  calls: CapturedJob[]
  /** The notification payloads only, narrowed. */
  notifications(): JobPayload['notifications'][]
  /** The alert jobs only, narrowed, with their enqueue options. */
  alerts(): CapturedAlert[]
}

export function queueDouble(): QueueDouble {
  const calls: CapturedJob[] = []
  return {
    calls,
    notifications: () => notificationsOf(calls),
    alerts: () => alertsOf(calls),
    async enqueue(name, payload, opts) {
      // The one assertion in the helper, and it is a limitation rather than a
      // shortcut: TypeScript cannot prove `{ name: N, payload: JobPayload[N] }`
      // inhabits the union while `N` is still generic, so the correlation has
      // to be asserted at the push. Annotating `job` first keeps that narrow —
      // name and payload are each checked against the real types, so the
      // assertion only supplies the pairing TS can't see, and a payload that
      // belongs to no queue at all is still a compile error here.
      const job: { name: JobName; payload: JobPayload[JobName]; opts?: EnqueueOptions } = {
        name,
        payload,
        opts,
      }
      calls.push(job as CapturedJob)
      return { job_id: 'test-job' }
    },
  }
}
