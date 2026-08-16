'use client'

/**
 * Conversation inbox — web port of mobile's (tabs)/messages: Unread and
 * Earlier sections, refreshed on mount (the live badge and inbox mirror
 * ride useInboxRealtime, mounted once in AppWorkspace).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { ConversationItem } from '@/components/chat'
import { Button } from '@/components/ui/Button'

export default function MessagesPage() {
  const { conversations, fetchConversations } = useChatStore()
  const [fetchError, setFetchError] = useState(false)

  // Error state settles only in the async continuations — a sync reset in
  // the mount effect trips react-hooks/set-state-in-effect.
  const load = useCallback(() => {
    fetchConversations()
      .then(() => setFetchError(false))
      .catch(() => setFetchError(true))
  }, [fetchConversations])

  useEffect(() => {
    load()
  }, [load])

  const unread = useMemo(() => conversations.filter((c) => c.unread_count > 0), [conversations])
  const earlier = useMemo(() => conversations.filter((c) => c.unread_count === 0), [conversations])

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="px-5 pb-2 pt-6">
        <h1 className="font-display text-2xl font-bold text-content-primary">Messages</h1>
        {unread.length > 0 && (
          <p className="mt-1 text-sm text-content-secondary">
            {unread.length} unread thread{unread.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-24 text-center">
          {fetchError ? (
            <>
              <p className="font-semibold text-content-primary">Couldn&apos;t load messages</p>
              <p className="text-sm text-content-secondary">Check your connection and try again.</p>
              <Button variant="outline" onClick={load}>Retry</Button>
            </>
          ) : (
            <>
              <MessageCircle size={30} className="text-brand-primary" />
              <p className="font-semibold text-content-primary">No conversations yet</p>
              <p className="text-sm text-content-secondary">
                Start a conversation by messaging a gig poster or worker.
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          {unread.length > 0 && <SectionHeader label="Unread" />}
          {unread.map((c) => (
            <ConversationItem key={c.id} conversation={c} />
          ))}
          {earlier.length > 0 && <SectionHeader label="Earlier" />}
          {earlier.map((c) => (
            <ConversationItem key={c.id} conversation={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-5 pb-1.5 pt-4 font-numeric text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">
      {label}
    </p>
  )
}
