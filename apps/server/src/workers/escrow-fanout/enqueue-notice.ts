/**
 * The one way this module reaches a user: enqueue the same notice to a list of
 * recipients, deep-linked at the escrow it is about.
 *
 * All three fan-outs (parties, applicants, new-gig subscribers) wrote this
 * loop out separately, each rebuilding the `data` bag by hand — the bag whose
 * `kind` decides whether the deep link opens /gig/:id or /exchange/:id.
 */

import { enqueueNotification, escrowPushData } from '@server/lib/notify'
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
  for (const user_id of user_ids) {
    if (user_id === null) continue
    // Fields named rather than spread: callers pass wider objects (the party
    // notice carries `recipient`), and a spread would put that in the job
    // input where nothing expects it.
    await enqueueNotification(queue, {
      user_id,
      title: notice.title,
      body: notice.body,
      data,
    })
  }
}
