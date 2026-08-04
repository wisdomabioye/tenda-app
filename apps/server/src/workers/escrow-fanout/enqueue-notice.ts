/**
 * The one way this module reaches a user: enqueue the same notice to a list of
 * recipients, deep-linked at the escrow it is about.
 *
 * The escrow-flavoured face of `enqueueNotificationToMany` — all this adds is
 * the `data` bag, the bag whose `kind` decides whether the deep link opens
 * /gig/:id or /exchange/:id. The loop itself lives in lib/notify.ts because the
 * dispute-alert fan-out needs the identical one with a different bag, and two
 * copies of "how one notice reaches N users" is one too many.
 */

import { enqueueNotificationToMany, escrowPushData } from '@server/lib/notify'
import type { QueueService } from '@server/plugins/queue'
import type { EscrowKind } from '@tenda/shared'
import type { NoticeCopy } from './copy'

export async function enqueueEscrowNotice(
  // The queue rather than the whole app, matching enqueueNotification's own
  // signature: this function touches nothing else on fastify.
  queue: Pick<QueueService, 'enqueue'>,
  escrow_id: string,
  kind: EscrowKind,
  // Nullable ids are accepted so callers can pass a party that may be absent
  // (an unassigned counterparty) without filtering at every call site.
  user_ids: readonly (string | null)[],
  notice: NoticeCopy,
): Promise<void> {
  // Built once: every recipient of one notice gets the same bag, and a gig
  // with a thousand subscribers should not allocate a thousand copies.
  const data = escrowPushData(escrow_id, kind)
  // Title/body named rather than spread: callers pass wider objects (the party
  // notice carries `recipient`), and a spread would put that in the job input
  // where nothing expects it.
  await enqueueNotificationToMany(queue, user_ids, {
    title: notice.title,
    body: notice.body,
    data,
  })
}
