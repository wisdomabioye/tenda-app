/**
 * Side-effect capture for fan-out tests: the two seams by which anything
 * reaches a user leave this process — a 'notifications' job on the queue, and
 * a WS frame.
 *
 * Tests that assert "who was told what" swap both for arrays instead of
 * running a real worker. Three suites had grown their own copy of that swap,
 * which is two too many for a decision as load-bearing as what counts as
 * having notified someone.
 */
import type { FastifyInstance } from 'fastify'
import type { JobName, JobPayload } from '@server/plugins/queue'

export interface EnqueuedJob {
  name: JobName
  payload: JobPayload['notifications']
}

export interface Broadcast {
  channel: string
  payload: Record<string, unknown>
}

export interface SideEffectCapture {
  /** Jobs enqueued since install, in order. */
  enqueued: EnqueuedJob[]
  /** WS frames broadcast since install, in order. */
  broadcasts: Broadcast[]
  /** Recipients of the notification jobs — the assertion most tests make. */
  notifiedUserIds(): string[]
}

/**
 * Replace the app's queue + WS broadcast with recorders and return what they
 * record. Call it again to start a fresh recording (the previous capture keeps
 * whatever it had, so a test can snapshot one phase then re-arm for the next).
 */
export function installCapture(app: FastifyInstance): SideEffectCapture {
  const capture: SideEffectCapture = {
    enqueued: [],
    broadcasts: [],
    notifiedUserIds: () =>
      capture.enqueued.filter((e) => e.name === 'notifications').map((e) => e.payload.user_id),
  }

  app.queue.enqueue = async (name, payload) => {
    // Cast, not a guard: every fan-out under test enqueues 'notifications',
    // and a payload that isn't one should fail the assertion, not vanish.
    capture.enqueued.push({ name, payload: payload as JobPayload['notifications'] })
    return { job_id: 'test-job' }
  }
  app.wsBroadcast.broadcast = (channel, payload) => {
    capture.broadcasts.push({ channel, payload })
    // The real broadcast answers how many sockets received the frame; no test
    // asserts on it, but the signature is part of the seam being replaced.
    return 0
  }

  return capture
}
