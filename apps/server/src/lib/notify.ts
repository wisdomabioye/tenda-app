/**
 * Notification write path — the SINGLE producer for 'notifications' jobs and
 * the worker-side persist + live WS broadcast. All notice sources (escrow
 * fan-out, review/fiat listeners, new-gig subscriber fan-out) route through
 * `enqueueNotification` so every job carries a stable id → the delivery
 * worker's insert is idempotent across BullMQ retries.
 *
 * It also owns the SERVER-SIDE deep-link contract: one `*PushData` builder per
 * `NOTIFICATION_SCREEN` member, no exceptions. The vocabulary is shared (so a
 * producer cannot invent a screen no client routes), the param SHAPE is
 * declared once here (so `escrowId` never drifts to `escrow_id` at one of the
 * nine call sites that used to hand-write these objects).
 */

import { createHash, randomUUID } from 'node:crypto'
import type { InferSelectModel } from 'drizzle-orm'
import { notifications } from '@tenda/shared/db/schema'
import {
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_SCREEN,
  ErrorCode,
} from '@tenda/shared'
import type { NotificationWire, EscrowKind } from '@tenda/shared'
import { channelName, type WsBroadcaster } from '@server/lib/ws'
import { isUuidLike } from '@server/lib/uuid'
import { AppError } from '@server/lib/errors'
import type { QueueService, JobPayload, EnqueueOptions } from '@server/plugins/queue'
import type { AppDatabase } from '@server/plugins/db'

/**
 * A notification's deep-link `data` bag. Matches `notifications.data`
 * (`jsonb().$type<Record<string, string>>()`) — jsonb is schemaless, so a
 * non-string value only surfaces as a client-side type lie, never a DB error.
 */
export type PushData = Record<string, string>

export interface NotificationInput {
  user_id: string
  title: string
  body: string
  data?: PushData
  /** Persist to the in-app centre + WS-broadcast. Default true; chat sets false. */
  persist?: boolean
  /**
   * Caller-supplied notification id, for producers that can be re-run for the
   * same logical notice (a channel job retried by BullMQ re-enqueues rather
   * than re-delivering, so the default random id would write a second row).
   * Build it with `stableNotificationId` — see the UUID guard below.
   */
  id?: string
}

/**
 * NUL separator: the parts are entity ids and channel slugs, and NUL is the
 * one byte none of them can contain, so ('a','bc') and ('ab','c') can never
 * hash to the same id. Escape sequence, never a literal control byte in
 * source — a raw NUL makes the file 'binary' to grep and diff tooling.
 */
const PART_SEPARATOR = '\u0000'

/**
 * Deterministic notification id derived from the identity of the notice.
 *
 * `notifications.id` is a postgres `uuid` column, so a producer CANNOT just
 * use a readable key like `dispute-alert.<id>.<user>` — that reaches the
 * driver as `invalid input syntax for type uuid`, and because it fails inside
 * the delivery worker it fails on every retry, forever, with no user-visible
 * signal. So the parts are hashed into a well-formed UUID instead.
 *
 * RFC 9562 version 8 (custom/vendor layout) is the honest version nibble for a
 * SHA-256-derived name: v5 is defined as SHA-1, and claiming v5 would misstate
 * the algorithm.
 */
export function stableNotificationId(...parts: string[]): string {
  const bytes = createHash('sha256').update(parts.join(PART_SEPARATOR)).digest().subarray(0, 16)
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x80, 6) // version 8 (RFC 9562 custom)
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8) // RFC 9562 variant
  const h = bytes.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Reject a malformed caller-supplied id.
 *
 * Fail here, at the producer, rather than in the delivery worker: a malformed
 * id only breaks at INSERT time, where the failure is a retry loop on a job
 * nobody is watching. Shared by the single- and many-recipient producers so
 * both refuse the same values with the same sentence.
 */
function assertNotificationId(id: string): void {
  if (!isUuidLike(id)) {
    throw new AppError(
      500,
      ErrorCode.INTERNAL_ERROR,
      'notification id must be a UUID (build it with stableNotificationId)',
    )
  }
}

/**
 * `NotificationInput` → the job payload, VALIDATING as it goes.
 *
 * Shared by the single- and many-recipient producers so the two cannot drift on
 * what a notification job looks like — the id default, the `persist` default
 * and the absent-vs-empty `data` rule are each decided once. It also puts the
 * id guard on the only path that builds a payload, which is what lets the
 * fan-out below validate the whole batch before enqueuing any of it: building
 * is separate from sending.
 */
function notificationJob(input: NotificationInput): JobPayload['notifications'] {
  if (input.id !== undefined) assertNotificationId(input.id)
  return {
    id: input.id ?? randomUUID(),
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    ...(input.data !== undefined ? { data: input.data } : {}),
    persist: input.persist ?? true,
  }
}

/**
 * Enqueue a notification. Stamps a stable id so the delivery worker can insert
 * with onConflictDoNothing — a retried job re-uses the same id and never
 * writes a duplicate row or double-fires the badge. `opts` passes through to
 * the queue (e.g. expire-escrows' `job_id` for cross-tick dedup).
 *
 * A caller-supplied `id` extends that idempotency across PRODUCER re-runs, not
 * just BullMQ's own retry of one job.
 */
export async function enqueueNotification(
  queue: Pick<QueueService, 'enqueue'>,
  input: NotificationInput,
  opts?: EnqueueOptions,
): Promise<void> {
  await queue.enqueue('notifications', notificationJob(input), opts)
}

/**
 * One notice, many recipients. Extends `NotificationInput` rather than
 * re-listing its fields so the two cannot drift — a field added there is
 * available here for free.
 */
export interface ManyNotificationInput extends Omit<NotificationInput, 'user_id' | 'id'> {
  /**
   * Per-recipient stable id, for producers that can be re-run for the same
   * logical notice. A FUNCTION of the recipient, never a plain string: the
   * notification id is the primary key, so one id shared across recipients
   * would let `persistNotification`'s onConflictDoNothing drop every row after
   * the first — the fan-out would silently notify one person. Build it with
   * `stableNotificationId`.
   */
  idFor?: (user_id: string) => string
}

/**
 * Enqueue the same notice to a list of recipients.
 *
 * The one loop by which a notice reaches more than one user. Every fan-out
 * (escrow parties, applicants, new-gig subscribers, dispute alerts) routes
 * through it, so the null-skip and the shared `data` bag are decided once —
 * this module's docstring claims to be the single producer of 'notifications'
 * jobs, and a second copy of this loop elsewhere would make that false.
 *
 * Nullable ids are accepted so callers can pass a party that may be absent
 * (an unassigned counterparty) without filtering at every call site.
 *
 * ONE ROUND TRIP, not one per recipient. The whole batch goes through
 * `enqueueMany`, which pipelines it — a subscriber fan-out to a thousand users
 * used to pay the Redis round trip a thousand times, and that cost is paid
 * inside the verify-tx worker slot that produced it.
 *
 * ALL-OR-NOTHING on a bad id. Every job is BUILT — which is where `idFor` is
 * resolved and validated — before anything is sent, because the guard throws.
 * Validating as we sent would leave a PARTIAL fan-out: the recipients before
 * the bad id notified, the ones after it silently not. Half a fan-out is worse
 * than none, since nothing downstream can tell it happened. Batching makes that
 * structural rather than merely careful — there is now a single send, so there
 * is no point between two sends for the guard to fire.
 *
 * Not transactional beyond that: `enqueueMany` pipelines rather than
 * transacts, so a Redis failure part-way still leaves some jobs enqueued. That
 * one is the queue's to own (jobs are retried), whereas a malformed id is a
 * caller bug that can be caught for free before any side effect.
 */
export async function enqueueNotificationToMany(
  queue: Pick<QueueService, 'enqueueMany'>,
  user_ids: readonly (string | null)[],
  notice: ManyNotificationInput,
): Promise<void> {
  const jobs = user_ids
    .filter((user_id): user_id is string => user_id !== null)
    .map((user_id) => {
      const id = notice.idFor?.(user_id)
      // Fields named rather than spread: `notice` may be a wider object than
      // ManyNotificationInput (excess-property checks only apply to literals),
      // and a spread would carry those extras into the job input.
      return {
        payload: notificationJob({
          user_id,
          title: notice.title,
          body: notice.body,
          ...(notice.data !== undefined ? { data: notice.data } : {}),
          ...(notice.persist !== undefined ? { persist: notice.persist } : {}),
          ...(id !== undefined ? { id } : {}),
        }),
      }
    })

  // Nothing to send is not a queue operation. Without this, a fan-out whose
  // recipients were all null would reach the queue and — on a box with no
  // REDIS_URL, where the stub throws — start failing a case that previously
  // succeeded by doing nothing. The old loop simply never iterated.
  if (jobs.length === 0) return

  await queue.enqueueMany('notifications', jobs)
}

/**
 * Push `data` for an escrow deep-link — `kind` lets the app route /gig/:id vs
 * /exchange/:id. Single builder shared by the escrow fan-out and the expiry
 * notice so both emit the canonical { screen, escrowId, kind } shape the
 * mobile resolver understands.
 */
export function escrowPushData(escrow_id: string, kind: EscrowKind): PushData {
  return { screen: NOTIFICATION_SCREEN.escrow, escrowId: escrow_id, kind }
}

/**
 * Push `data` for the dispute thread. Carries BOTH ids on purpose: mobile
 * opens a dispute by its escrow (`/dispute/:escrowId`) while the admin
 * dashboard keys the mediation queue by `disputes.id`, so a payload with only
 * one of them is un-routable on the other surface.
 *
 * `dispute_id` is nullable because an escrow can be `disputed` on-chain with no
 * off-chain `disputes` row (the raise tx confirms, the triage upsert is a
 * separate write). Omitting the key beats inventing one: mobile still routes on
 * the escrow id, and the dashboard has no row to open anyway.
 */
export function disputePushData(escrow_id: string, dispute_id: string | null): PushData {
  return {
    screen: NOTIFICATION_SCREEN.dispute,
    escrowId: escrow_id,
    ...(dispute_id !== null ? { disputeId: dispute_id } : {}),
  }
}

/** Push `data` for a chat message — `userId` is the SENDER, for the thread header. */
export function chatPushData(conversation_id: string, sender_id: string): PushData {
  return { screen: NOTIFICATION_SCREEN.chat, conversationId: conversation_id, userId: sender_id }
}

/** Push `data` for a fiat on/off-ramp intent (stage 8 settled/failed notices). */
export function fiatIntentPushData(intent_id: string): PushData {
  return { screen: NOTIFICATION_SCREEN.fiatIntent, intentId: intent_id }
}

type NotificationRow = InferSelectModel<typeof notifications>

/** DB row → wire shape. Shared by the WS frame here and the REST feed (read API). */
export function toNotificationWire(row: NotificationRow): NotificationWire {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    data: row.data ?? null,
    read_at: row.read_at?.toISOString() ?? null,
    created_at: row.created_at?.toISOString() ?? null,
  }
}

export interface PersistDeps {
  db: AppDatabase
  wsBroadcast: WsBroadcaster
}

/**
 * Persist a notification and, only when a NEW row is written, broadcast a live
 * NotificationFrame on the recipient's `user:<id>` channel. onConflictDoNothing
 * returns [] on a retry duplicate → no second row, no second badge. Title/body
 * are clamped to the column caps so a composed body can never overflow the
 * column and 5xx the insert.
 */
export async function persistNotification(
  deps: PersistDeps,
  payload: JobPayload['notifications'],
): Promise<void> {
  const [row] = await deps.db
    .insert(notifications)
    .values({
      id: payload.id,
      user_id: payload.user_id,
      title: payload.title.slice(0, NOTIFICATION_TITLE_MAX),
      body: payload.body.slice(0, NOTIFICATION_BODY_MAX),
      ...(payload.data !== undefined ? { data: payload.data } : {}),
    })
    .onConflictDoNothing({ target: notifications.id })
    .returning()
  if (row === undefined) return // retry duplicate — already delivered

  deps.wsBroadcast.broadcast(channelName({ kind: 'user', id: payload.user_id }), {
    type: 'notification',
    notification: toNotificationWire(row),
  })
}
