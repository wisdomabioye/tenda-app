'use client'

/**
 * One inbox row — web twin of mobile's chat ConversationItem: avatar with
 * unread dot, name, last-message preview, mono time chip and unread count.
 */
import Link from 'next/link'
import { formatConvoTime, formatFullName, type Conversation } from '@tenda/shared'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

export function ConversationItem({ conversation }: { conversation: Conversation }) {
  const { other_user, last_message, last_message_at, unread_count } = conversation
  const displayName =
    formatFullName(other_user.first_name, other_user.last_name) || 'Anonymous'

  const isUnread = unread_count > 0
  const time = last_message_at ? formatConvoTime(last_message_at) : ''

  return (
    <Link
      href={`/chat/${other_user.id}`}
      aria-label={`Open chat with ${displayName}`}
      className="flex min-h-[72px] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-inset"
    >
      <Avatar size="md" name={displayName} src={other_user.avatar_url} unreadDot={isUnread} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-content-primary">
          {displayName}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate text-[13px]',
            isUnread ? 'font-medium text-content-primary' : 'text-content-tertiary',
          )}
        >
          {last_message ?? 'No messages yet'}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={cn(
            'font-numeric text-[10.5px] font-medium tracking-wide',
            isUnread ? 'text-brand-primary' : 'text-content-tertiary',
          )}
        >
          {time}
        </span>
        {isUnread && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-solid px-1.5 text-[11px] font-bold text-brand-on-primary">
            {unread_count > 9 ? '9+' : String(unread_count)}
          </span>
        )}
      </span>
    </Link>
  )
}
