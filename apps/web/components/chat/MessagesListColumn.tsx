'use client'

/**
 * The inbox as the workspace's list column (Tier 2 comp, lines 388-484).
 *
 * Mounted by BOTH `@list/messages` and `@list/chat`, which is what makes the
 * comps' promise literal: opening a thread swaps only the detail pane, and the
 * list it was opened from never leaves. The two slots render the same
 * component, so there is no second copy of the inbox to drift.
 *
 * Rows are keyed by the OTHER USER, not the conversation: /chat/[userId] is
 * the thread's address (conversations are user-to-user and are found or
 * created by participant pair), so the id in the URL is the one the list has
 * to match against to say which row is open.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Conversation } from '@tenda/shared'
import { ListColumn } from '@/components/app/workspace/list'
import { ConversationRow } from '@/components/app/workspace/rows'
import { useChatStore } from '@/stores/chat.store'
import { useCommandPalette } from '@/hooks/workspace/useCommandPalette'
import { MESSAGES_LIST_COPY } from './copy'

/** `/chat/<userId>` → the user whose thread is open, else null. */
export function openThreadUserId(pathname: string): string | null {
  const match = /^\/chat\/([^/]+)/.exec(pathname)
  return match === null ? null : match[1]
}

export function MessagesListColumn() {
  const conversations = useChatStore((s) => s.conversations)
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  const { openPalette } = useCommandPalette()
  const pathname = usePathname()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Both settled in the async continuations — a synchronous reset inside the
  // effect trips react-hooks/set-state-in-effect, and the mount render would
  // show "loaded and empty" for a frame before the request even starts.
  const load = useCallback(() => {
    fetchConversations()
      .then(() => setError(null))
      .catch(() => setError(MESSAGES_LIST_COPY.error))
      .finally(() => setLoading(false))
  }, [fetchConversations])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => {
    const unread = conversations.filter((c) => c.unread_count > 0)
    const earlier = conversations.filter((c) => c.unread_count === 0)
    // A section with no rows is not rendered at all: an "Unread" heading over
    // nothing reads as a list that failed to load.
    return [
      { key: 'unread', label: MESSAGES_LIST_COPY.unread, rows: unread },
      { key: 'earlier', label: MESSAGES_LIST_COPY.earlier, rows: earlier },
    ].filter((group) => group.rows.length > 0)
  }, [conversations])

  const unreadCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count > 0 ? 1 : 0), 0),
    [conversations],
  )

  return (
    <ListColumn<Conversation>
      copy={MESSAGES_LIST_COPY.surface}
      groups={groups}
      keyOf={(c) => c.other_user.id}
      hrefOf={(c) => `/chat/${c.other_user.id}`}
      selectedKey={openThreadUserId(pathname) ?? undefined}
      isLoading={loading}
      error={error}
      countLabel={unreadCount > 0 ? MESSAGES_LIST_COPY.count(unreadCount) : undefined}
      onOpenPalette={openPalette}
      onRetry={load}
      renderRow={(c, { active }) => (
        <ConversationRow
          href={`/chat/${c.other_user.id}`}
          party={c.other_user}
          // `last_message` already carries the wire's own attachment
          // placeholder, so the inbox and the push notification say the same
          // thing about the same message. Only a thread with NO messages
          // falls through to copy of our own.
          preview={c.last_message ?? MESSAGES_LIST_COPY.noMessages}
          at={c.last_message_at}
          unread={c.unread_count > 0}
          selected={active}
        />
      )}
    />
  )
}
