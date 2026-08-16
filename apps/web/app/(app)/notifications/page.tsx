'use client'

/**
 * Notification centre — web port of mobile's app/notifications: pinned
 * announcements (broadcasts) above the cursor-paginated personal list.
 * Clicking a notice marks it read and deep-links (web's own routing table
 * over the shared screen vocabulary); the header's check-all clears the
 * badge. Realtime + the badge count live in notifications.store; this page
 * only reads + drives it. Mobile's infinite onEndReached becomes an
 * explicit Load-more button.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import type { NotificationWire } from '@tenda/shared'
import { NotificationRow, AnnouncementCard } from '@/components/notifications'
import { useNotificationsStore } from '@/stores/notifications.store'
import { notificationRoute } from '@/lib/notification-route'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export default function NotificationsPage() {
  const router = useRouter()
  const notifications = useNotificationsStore((s) => s.notifications)
  const announcements = useNotificationsStore((s) => s.announcements)
  const unread = useNotificationsStore((s) => s.unread)
  const loading = useNotificationsStore((s) => s.loading)
  const loadingMore = useNotificationsStore((s) => s.loadingMore)
  const hasMore = useNotificationsStore((s) => s.hasMore)

  useEffect(() => {
    void useNotificationsStore.getState().fetchFeed()
  }, [])

  function handlePress(n: NotificationWire) {
    void useNotificationsStore.getState().markRead(n.id)
    const route = notificationRoute(n.data)
    if (route !== null) router.push(route)
  }

  const empty = !loading && notifications.length === 0 && announcements.length === 0

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="flex items-center justify-between px-4 pb-3 pt-6">
        <h1 className="font-display text-2xl font-bold text-content-primary">Notifications</h1>
        {unread > 0 && (
          <Button
            variant="ghost"
            onClick={() => void useNotificationsStore.getState().markAllRead()}
            aria-label="Mark all read"
          >
            <CheckCheck size={18} /> Mark all read
          </Button>
        )}
      </header>

      {announcements.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 px-4">
        {notifications.map((n) => (
          <NotificationRow key={n.id} notification={n} onPress={() => handlePress(n)} />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {empty && (
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <Bell size={40} className="text-content-secondary" />
          <p className="font-semibold text-content-primary">No notifications yet</p>
          <p className="text-sm text-content-secondary">
            Updates about your gigs, exchanges, and account will show up here.
          </p>
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void useNotificationsStore.getState().fetchMore()}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
