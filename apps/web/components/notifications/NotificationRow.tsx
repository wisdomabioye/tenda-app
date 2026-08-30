'use client'

/**
 * One notice in the centre — web twin of mobile's NotificationRow: screen-
 * derived icon, unread = inset background + brand dot, relative timestamp.
 */
import { createElement } from 'react'
import type { NotificationWire } from '@tenda/shared'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { notificationIcon } from './notification-icon'
import { cn } from '@/lib/cn'

export function NotificationRow({
  notification,
  onPress,
}: {
  notification: NotificationWire
  onPress: () => void
}) {
  const unread = notification.read_at === null

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${notification.title}${unread ? ', unread' : ''}`}
      className={cn(
        'flex w-full items-start gap-3 rounded-[14px] px-4 py-3 text-left transition-opacity hover:opacity-80',
        unread ? 'bg-surface-inset' : 'bg-transparent',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-background">
        {/* createElement: a capitalized render-alias trips react-hooks/static-components */}
        {createElement(notificationIcon(notification.data), { size: 18, className: 'text-content-secondary' })}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-content-primary">
          {notification.title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-[18px] text-content-secondary">
          {notification.body}
        </span>
        <RelativeTime
          iso={notification.created_at}
          className="mt-1 block text-xs text-content-tertiary"
        />
      </span>

      {unread && (
        <span data-testid="notification-unread-dot" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-solid" />
      )}
    </button>
  )
}
