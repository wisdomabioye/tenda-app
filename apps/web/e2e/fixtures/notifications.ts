/**
 * Notification world for the e2e stub: two personal notices (one unread,
 * routable to the seeded delivery gig) + one pinned announcement. Mutable
 * (mark-read/all) with the same reset contract as the chat world, so CI
 * retries start from the seeded state. Typed against the real wire types.
 */
import type { AnnouncementWire, NotificationFeed, NotificationWire } from '@tenda/shared'

interface NotificationsWorld {
  notifications: NotificationWire[]
  announcements: AnnouncementWire[]
}

export function createNotificationsWorld(): NotificationsWorld {
  return {
    notifications: [
      {
        id: 'ntf-2',
        title: 'Gig accepted',
        body: 'Bola accepted “Deliver a parcel across Yaba”.',
        data: { screen: 'escrow', escrowId: 'gig-delivery-1', kind: 'gig' },
        read_at: null,
        created_at: '2026-08-15T12:00:00.000Z',
      },
      {
        id: 'ntf-1',
        title: 'Welcome to Tenda',
        body: 'Post your first gig to get started.',
        data: null,
        read_at: '2026-08-14T09:00:00.000Z',
        created_at: '2026-08-14T08:00:00.000Z',
      },
    ],
    announcements: [
      {
        id: 'ann-1',
        title: 'Fee update',
        body: 'Platform fees drop to 2% this month.',
        priority: 1,
        published_at: '2026-08-13T00:00:00.000Z',
        expires_at: null,
      },
    ],
  }
}

export function resetNotificationsWorld(world: NotificationsWorld): void {
  Object.assign(world, createNotificationsWorld())
}

function unreadCount(world: NotificationsWorld): number {
  return world.notifications.filter((n) => n.read_at === null).length
}

/** Notification routes; returns null when the URL is not this domain's. */
export function handleNotifications(
  world: NotificationsWorld,
  url: URL,
  method: string,
): { statusCode: number; payload: unknown } | null {
  if (url.pathname === '/v1/notifications' && method === 'GET') {
    const feed: NotificationFeed = {
      notifications: world.notifications,
      announcements: world.announcements,
      unread_count: unreadCount(world),
    }
    return { statusCode: 200, payload: feed }
  }
  if (url.pathname === '/v1/notifications/unread-count' && method === 'GET') {
    return { statusCode: 200, payload: { count: unreadCount(world) } }
  }
  if (url.pathname === '/v1/notifications/read-all' && method === 'POST') {
    world.notifications = world.notifications.map((n) =>
      n.read_at === null ? { ...n, read_at: new Date().toISOString() } : n,
    )
    return { statusCode: 200, payload: { ok: true } }
  }
  const markRead = url.pathname.match(/^\/v1\/notifications\/([^/]+)\/read$/)
  if (markRead !== null && method === 'POST') {
    world.notifications = world.notifications.map((n) =>
      n.id === markRead[1] ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
    )
    return { statusCode: 200, payload: { ok: true } }
  }
  return null
}
