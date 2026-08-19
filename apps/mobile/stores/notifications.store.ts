/**
 * Notification-centre store — the in-app feed behind the bell (Stage 5).
 *
 * `unread` is the badge's single source of truth: server-authoritative on every
 * fetch (`unread_count`), bumped live when a `NotificationFrame` arrives on the
 * `user:<id>` WS channel (see realtime.store), and decremented optimistically on
 * mark-read. Personal notices are cursor-paginated; announcements are the
 * server's already-targeted, unpaginated set (pinned above the list).
 */

import { create } from 'zustand'
import { NOTIFICATION_PAGE_SIZE } from '@tenda/shared'
import type { NotificationWire, AnnouncementWire, LoadStatus } from '@tenda/shared'
import { api } from '@/api/client'

interface NotificationsState {
  notifications: NotificationWire[]
  announcements: AnnouncementWire[]
  unread: number
  /**
   * A full-feed request is IN FLIGHT. Deliberately NOT the same question as
   * "should the surface show a skeleton or withdraw its empty state" — that is
   * `feedStatus`, which a settled feed keeps through a background refresh. This
   * one must stay honest whenever a request is running, because `fetchMore`
   * uses it for mutual exclusion: a concurrent fetchFeed replaces the list
   * wholesale while fetchMore appends against the old cursor.
   *
   * It was called `loading` and the screen read it for display, which is how
   * the empty state came to blink (#57). Two names because they are two
   * questions; one name is what let them be confused.
   */
  isFetchingFeed: boolean
  /**
   * Whether the feed has ever been read from the server, in the SHARED
   * vocabulary (`LoadStatus`) rather than a fourth private copy of it — the
   * type exists because this exact union had already been written twice.
   */
  feedStatus: LoadStatus
  loadingMore: boolean
  hasMore: boolean

  /** Load (or reload) the first page + announcements + unread count. */
  fetchFeed: () => Promise<void>
  /** Append the next older page of personal notices (cursor = oldest loaded). */
  fetchMore: () => Promise<void>
  /** Lightweight badge refresh (no list load) — mount / reconnect / foreground. */
  refreshUnread: () => Promise<void>
  /** WS delivery of a new personal notice: prepend + bump the badge (deduped). */
  receive: (n: NotificationWire) => void
  /** Optimistically mark one notice read, then persist. */
  markRead: (id: string) => Promise<void>
  /** Optimistically clear the badge (notices + announcement cursor), then persist. */
  markAllRead: () => Promise<void>
  /** Drop all state on logout, so the next account never sees these notices. */
  reset: () => void
}

const INITIAL = {
  notifications: [] as NotificationWire[],
  announcements: [] as AnnouncementWire[],
  unread: 0,
  isFetchingFeed: false,
  feedStatus: 'idle' as LoadStatus,
  loadingMore: false,
  hasMore: false,
}

/** Oldest loaded notice = the pagination cursor (feed is newest-first). */
function oldestId(list: NotificationWire[]): string | null {
  return list.length > 0 ? list[list.length - 1].id : null
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...INITIAL,

  fetchFeed: async () => {
    // The request is in flight either way; the STATUS only moves for a feed
    // that has not settled. The screen withdraws its empty state while the
    // status is 'loading', which is right for a first load and wrong for a
    // refresh — on an account that genuinely has no notifications, every
    // pull-to-refresh made "No notifications yet" disappear and come back (#57).
    set((s) =>
      s.feedStatus === 'ready'
        ? { isFetchingFeed: true }
        : { isFetchingFeed: true, feedStatus: 'loading' },
    )
    try {
      const feed = await api.notifications.feed()
      set({
        notifications: feed.notifications,
        announcements: feed.announcements,
        unread: feed.unread_count,
        hasMore: feed.notifications.length >= NOTIFICATION_PAGE_SIZE,
        isFetchingFeed: false,
        feedStatus: 'ready',
      })
    } catch {
      // Still swallowed — every caller here is fire-and-forget — but recorded,
      // so a surface that wants to tell a failed load from an empty account
      // can. Only when nothing has settled yet: a failed refresh must not
      // discard an answer the reader already has.
      set((s) =>
        s.feedStatus === 'ready'
          ? { isFetchingFeed: false }
          : { isFetchingFeed: false, feedStatus: 'error' },
      )
    }
  },

  fetchMore: async () => {
    const { notifications, hasMore, loadingMore, isFetchingFeed } = get()
    const cursor = oldestId(notifications)
    if (cursor === null || !hasMore || loadingMore || isFetchingFeed) return
    set({ loadingMore: true })
    try {
      const feed = await api.notifications.feed({ before_id: cursor })
      set((s) => {
        // Dedupe on append: a concurrent refresh (or WS receive) can reshape the
        // list mid-flight, so drop any id already present rather than risk a
        // duplicate FlatList key.
        const seen = new Set(s.notifications.map((n) => n.id))
        const fresh = feed.notifications.filter((n) => !seen.has(n.id))
        return {
          notifications: [...s.notifications, ...fresh],
          hasMore: feed.notifications.length >= NOTIFICATION_PAGE_SIZE,
          loadingMore: false,
        }
      })
    } catch {
      set({ loadingMore: false })
    }
  },

  refreshUnread: async () => {
    try {
      const { count } = await api.notifications.unreadCount()
      set({ unread: count })
    } catch {
      // Badge keeps its last value; the next fetch/frame reconciles.
    }
  },

  receive: (n) => {
    set((s) => {
      if (s.notifications.some((x) => x.id === n.id)) return s // dedupe vs a fetch race
      return {
        notifications: [n, ...s.notifications],
        unread: s.unread + (n.read_at === null ? 1 : 0),
      }
    })
  },

  markRead: async (id) => {
    const target = get().notifications.find((x) => x.id === id)
    if (target === undefined || target.read_at !== null) return // absent or already read
    set((s) => ({
      notifications: s.notifications.map((x) =>
        x.id === id ? { ...x, read_at: new Date().toISOString() } : x,
      ),
      unread: Math.max(0, s.unread - 1),
    }))
    try {
      await api.notifications.markRead({ id })
    } catch {
      // Low-stakes; the next fetchFeed reconciles read state from the server.
    }
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((x) =>
        x.read_at === null ? { ...x, read_at: new Date().toISOString() } : x,
      ),
      unread: 0,
    }))
    try {
      await api.notifications.markAllRead()
    } catch {
      // Reconciles on next fetchFeed.
    }
  },

  reset: () => set({ ...INITIAL }),
}))
