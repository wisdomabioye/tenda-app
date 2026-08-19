'use client'

/**
 * One notification, in the detail pane (Tier 2 comp, lines 1348-1362).
 *
 * Opening it is what marks it read — the comp's row has a CTA ("Open the
 * escrow") and the read state follows the READ, not the row's click, so a
 * notice opened by keyboard or by deep link clears the badge exactly as a
 * clicked one does.
 *
 * The route it offers comes from the shared screen vocabulary through
 * `notificationRoute`; a payload naming a screen this app has no route for
 * says so rather than rendering a dead button.
 */
import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatRelativeShort } from '@tenda/shared'
import { useNotificationsStore } from '@/stores/notifications.store'
import { notificationRoute } from '@/lib/notification-route'
import { buttonVariants } from '@/components/ui'
import { DetailEmpty } from '@/components/app/workspace/detail'
import { NOTIFICATIONS_LIST_COPY } from '@/components/notifications/copy'

export default function NotificationDetailPage() {
  const { notificationId } = useParams<{ notificationId: string }>()
  const notification = useNotificationsStore((s) =>
    s.notifications.find((n) => n.id === notificationId),
  )
  // The IN-FLIGHT flag, not the status: this asks "has the feed landed yet",
  // and a settled feed keeps status 'ready' straight through a refresh (#48).
  const isFetchingFeed = useNotificationsStore((s) => s.isFetchingFeed)
  const isUnread = notification !== undefined && notification.read_at === null

  useEffect(() => {
    if (isUnread) void useNotificationsStore.getState().markRead(notificationId)
  }, [isUnread, notificationId])

  if (notification === undefined) {
    // "Pick a notification" is a claim about what the reader has done, and on
    // a DEEP LINK they have already picked one — the feed simply has not
    // landed yet. Say nothing until it has; the empty state is the answer only
    // once the id is genuinely not among the notices this account holds.
    if (isFetchingFeed) return null
    return (
      <DetailEmpty
        title={NOTIFICATIONS_LIST_COPY.emptyDetailTitle}
        body={NOTIFICATIONS_LIST_COPY.emptyDetailBody}
      />
    )
  }

  const route = notificationRoute(notification.data)

  return (
    <article className="max-w-[720px] px-9 pb-16 pt-7">
      <h1 className="font-display text-[26px] font-bold leading-8 tracking-[-0.5px] text-content-primary">
        {notification.title}
      </h1>
      {notification.created_at !== null && (
        <p className="mt-2 font-numeric text-xs leading-4 text-content-tertiary">
          {formatRelativeShort(notification.created_at)}
        </p>
      )}
      <p className="mt-5 whitespace-pre-wrap text-[15px] leading-[22px] text-content-secondary">
        {notification.body}
      </p>
      <div className="mt-7">
        {route === null ? (
          <p className="text-[13px] leading-[18px] text-content-tertiary">
            {NOTIFICATIONS_LIST_COPY.noRoute}
          </p>
        ) : (
          <Link href={route} className={buttonVariants({ variant: 'primary' })}>
            {NOTIFICATIONS_LIST_COPY.open}
          </Link>
        )}
      </div>
    </article>
  )
}
