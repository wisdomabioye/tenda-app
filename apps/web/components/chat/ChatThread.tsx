'use client'

/**
 * The chat thread screen — web port of mobile app/chat/[userId].tsx.
 * Feed renders chronologically with day headers + escrow-context dividers
 * (shared buildMessageFeed), pinned to the bottom on new messages.
 * Attachments ride the scoped-upload registry; image attachments open the
 * lightbox, PDFs open in a new tab (the browser is the document viewer).
 * Message reporting (mobile: long-press → ReportSheet) arrives with the
 * moderation surfaces in S6.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildMessageFeed, isDivider, isTimestamp, formatFullName } from '@tenda/shared'
import { useChatStore, type LocalMessage } from '@/stores/chat.store'
import { useAuthStore } from '@/stores/auth.store'
import { useConversation } from './useConversation'
import { useChatRealtime } from './useChatRealtime'
import { useAttachmentUpload } from '@/hooks/uploads/useAttachmentUpload'
import { ChatHeader } from './ChatHeader'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { ChatContextDivider } from './ChatContextDivider'
import { ChatTimestampGroup } from './ChatTimestampGroup'
import { MediaViewerModal, type MediaItem } from '@/components/shared/media/MediaViewerModal'
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

export interface ChatEscrowContext {
  escrowId: string
  escrowTitle: string | null
  kind: 'gig' | 'exchange' | null
}

export function ChatThread({ userId, context }: { userId: string; context?: ChatEscrowContext }) {
  const router = useRouter()
  const myId = useAuthStore((s) => s.user?.id ?? '')
  const { sendMessage, retryMessage, closeConversation, messages } = useChatStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewing, setViewing] = useState<MediaItem | null>(null)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)

  const { conversationId, otherUser, loading, initError, retry } = useConversation(userId)
  useChatRealtime(conversationId)

  // Popover dismissal without an overlay layer (ModalBackdrop is for
  // dialogs): any document click or Escape closes the header menu. The
  // listener attaches AFTER the opening click's dispatch completes, so
  // opening never instantly self-closes.
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const feed = useMemo(() => {
    const msgs = conversationId ? (messages[conversationId] ?? []) : []
    return buildMessageFeed(msgs)
  }, [conversationId, messages])

  // Pin the view to the newest message whenever the feed grows.
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [feed.length])

  const escrowContext = context ? { escrowId: context.escrowId, kind: context.kind } : undefined

  const { uploading, upload } = useAttachmentUpload({
    type: 'chat',
    scopeId: conversationId,
    onUploaded: (attachment) => {
      if (conversationId) void sendMessage(conversationId, '', escrowContext, attachment)
    },
  })

  function handleRetry(msg: LocalMessage) {
    if (!conversationId) return
    retryMessage(conversationId, msg)
  }

  async function confirmCloseConversation() {
    if (!conversationId) return
    setClosing(true)
    try {
      await closeConversation(conversationId)
      setCloseConfirm(false)
      router.push('/messages')
    } catch {
      showToast('error', 'Failed to close conversation, please try again')
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="flex flex-1 flex-col">
        <ChatHeader name="Chat" onBack={() => router.back()} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="font-semibold text-content-primary">Couldn&apos;t open chat</p>
          <p className="text-sm text-content-secondary">There was a problem starting this conversation.</p>
          <Button variant="outline" onClick={retry}>Retry</Button>
        </div>
      </div>
    )
  }

  const displayName = otherUser
    ? formatFullName(otherUser.first_name, otherUser.last_name) || 'Anonymous'
    : 'User'

  return (
    // Viewport lock: -my-5 cancels AppShell <main>'s py-5, and 57px is the
    // shell header's PINNED h-14 (56px) + its 1px border — together the
    // column is exactly the viewport, so the composer never sits below the
    // fold and the only scroller is the message list.
    <div className="-my-5 flex h-[calc(100dvh-57px)] flex-col">
      <div className="relative">
        <ChatHeader
          name={displayName}
          avatarUrl={otherUser?.avatar_url}
          onBack={() => router.back()}
          onMenu={() => setMenuOpen((v) => !v)}
        />
        {menuOpen && (
          <div className="absolute right-3 top-14 z-10 w-64 rounded-card border border-border-subtle bg-surface-card p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setCloseConfirm(true)
              }}
              className="w-full rounded-control px-3 py-2.5 text-left transition-colors hover:bg-surface-inset"
            >
              <span className="block text-sm font-semibold text-feedback-danger-base">Close conversation</span>
              <span className="mt-0.5 block text-xs text-content-secondary">
                You&apos;ll stop seeing this thread in Messages. It reopens if either of you sends a new message.
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {feed.length === 0 && (
          <p className="flex h-full items-center justify-center text-content-tertiary">
            No messages yet. Say hi!
          </p>
        )}
        {feed.map((item) => {
          if (isDivider(item)) {
            return (
              <ChatContextDivider
                key={item._key}
                escrowId={item.escrow_id}
                escrowTitle={item.escrow_title}
                kind={item.escrow_kind}
              />
            )
          }
          if (isTimestamp(item)) return <ChatTimestampGroup key={item._key} iso={item.iso} />
          return (
            <MessageBubble
              key={item.id}
              message={item}
              isMine={item.sender_id === myId}
              onRetry={item._status === 'failed' ? () => handleRetry(item) : undefined}
              onAttachmentPress={(a) => {
                if (a.type === 'image') setViewing({ id: a.id, url: a.url, kind: 'image' })
                else window.open(a.url, '_blank', 'noopener')
              }}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {context && (
        <ChatContextDivider
          escrowId={context.escrowId}
          escrowTitle={context.escrowTitle}
          kind={context.kind}
        />
      )}
      {uploading && (
        <p className="py-1 text-center text-xs text-content-tertiary">Uploading attachment…</p>
      )}
      <ChatInput
        onSend={(text) => {
          if (conversationId) void sendMessage(conversationId, text, escrowContext)
        }}
        onAttach={(file) => void upload(file)}
        disabled={uploading}
      />

      <MediaViewerModal item={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={closeConfirm}
        title="Close conversation"
        message="This will hide the conversation from your inbox. It will reopen if you message again."
        confirmLabel="Close"
        destructive
        busy={closing}
        onConfirm={() => void confirmCloseConversation()}
        onCancel={() => setCloseConfirm(false)}
      />
    </div>
  )
}
