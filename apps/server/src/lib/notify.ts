/**
 * Notification write path — the SINGLE producer for 'notifications' jobs and
 * the worker-side persist + live WS broadcast. All notice sources (escrow
 * fan-out, review/fiat listeners, new-gig subscriber fan-out) route through
 * `enqueueNotification` so every job carries a stable id → the delivery
 * worker's insert is idempotent across BullMQ retries.
 */

import { randomUUID } from 'node:crypto'
import type { InferSelectModel } from 'drizzle-orm'
import { notifications } from '@tenda/shared/db/schema'
import { NOTIFICATION_TITLE_MAX, NOTIFICATION_BODY_MAX } from '@tenda/shared'
import type { NotificationWire, EscrowKind } from '@tenda/shared'
import { channelName, type WsBroadcaster } from '@server/lib/ws'
import type { QueueService, JobPayload, EnqueueOptions } from '@server/plugins/queue'
import type { AppDatabase } from '@server/plugins/db'

export interface NotificationInput {
  user_id: string
  title: string
  body: string
  data?: Record<string, string>
  /** Persist to the in-app centre + WS-broadcast. Default true; chat sets false. */
  persist?: boolean
}

/**
 * Enqueue a notification. Stamps a stable id so the delivery worker can insert
 * with onConflictDoNothing — a retried job re-uses the same id and never
 * writes a duplicate row or double-fires the badge. `opts` passes through to
 * the queue (e.g. expire-escrows' `job_id` for cross-tick dedup).
 */
export async function enqueueNotification(
  queue: Pick<QueueService, 'enqueue'>,
  input: NotificationInput,
  opts?: EnqueueOptions,
): Promise<void> {
  await queue.enqueue(
    'notifications',
    {
      id: randomUUID(),
      user_id: input.user_id,
      title: input.title,
      body: input.body,
      ...(input.data !== undefined ? { data: input.data } : {}),
      persist: input.persist ?? true,
    },
    opts,
  )
}

/**
 * Push `data` for an escrow deep-link — `kind` lets the app route /gig/:id vs
 * /exchange/:id. Single builder shared by the escrow fan-out and the expiry
 * notice so both emit the canonical { screen, escrowId, kind } shape the
 * mobile resolver understands.
 */
export function escrowPushData(escrow_id: string, kind: EscrowKind): Record<string, string> {
  return { screen: 'escrow', escrowId: escrow_id, kind }
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
