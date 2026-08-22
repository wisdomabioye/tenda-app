'use client'

/**
 * The workspace's 64px icon rail (Tier 2 comp, lines 364-386): brand mark,
 * navigable surfaces, then a pinned foot of Post / theme / settings / avatar.
 *
 * Live counters are read here rather than in the item config so the config
 * stays a pure, testable list. The socket + realtime mirrors deliberately do
 * NOT live here — they belong to the shell that owns the whole authed
 * session, not to one of its columns.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { APP_INFO, displayName, type User } from '@tenda/shared'
import { cn } from '@/lib/cn'
import { useChatStore } from '@/stores/chat.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { ThemeToggle } from '@/components/app/ThemeToggle'
import { useRailExpansion } from '@/hooks/workspace/useRailExpansion'
import { Avatar } from '@/components/ui/Avatar'
import { RailLink, RAIL_SLOT } from './RailLink'
import { CreateMenu } from './CreateMenu'
import {
  RAIL_PROFILE,
  RAIL_SETTINGS,
  isRailItemActive,
  visibleRailItems,
  type RailBadgeSource,
} from './rail-items'

export function Rail({ user }: { user: User | null }) {
  const pathname = usePathname()
  const messageUnread = useChatStore((s) => s.unread)
  const notificationUnread = useNotificationsStore((s) => s.unread)
  const { expanded, toggle } = useRailExpansion()

  const counts: Record<RailBadgeSource, number> = {
    messages: messageUnread,
    notifications: notificationUnread,
  }

  const items = visibleRailItems(user?.advanced_mode_enabled === true)
  return (
    <nav
      aria-label="Workspace"
      data-expanded={expanded}
      // w-full, not w-16: the grid column already IS --pane-rail. Repeating
      // 64px here would silently desync the moment that token changes.
      className="flex h-full min-h-0 w-full flex-col items-center gap-1.5 overflow-visible border-r border-border-subtle bg-surface-background-alt py-3.5"
    >
      <Link
        href="/home"
        aria-label={`${APP_INFO.name} home`}
        className="mb-2.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-brand-solid font-display text-[17px] font-bold text-brand-on-primary"
      >
        {APP_INFO.name.slice(0, 1)}
      </Link>

      {items.map((item) => (
        <RailLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={isRailItemActive(pathname, item.href)}
          badgeCount={item.badge === undefined ? 0 : counts[item.badge]}
          expanded={expanded}
        />
      ))}

      {/* Pushes the action cluster to the foot of the rail. */}
      <span className="flex-1" aria-hidden />

      <CreateMenu expanded={expanded} />

      <ThemeToggle className={RAIL_SLOT} />

      <RailLink
        href={RAIL_SETTINGS.href}
        label={RAIL_SETTINGS.label}
        icon={Settings}
        active={isRailItemActive(pathname, RAIL_SETTINGS.href)}
        expanded={expanded}
      />

      {/* Avatar (not a hand-rolled initials span): it already owns the
          initials fallback AND renders the real avatar_url when the user has
          one, which the comp's static "SO" placeholder cannot show. */}
      <Link
        href={RAIL_PROFILE.href}
        aria-label={
          user === null
            ? RAIL_PROFILE.label
            : `${RAIL_PROFILE.label}, ${displayName(user.first_name, user.last_name, user.id)}`
        }
        title={RAIL_PROFILE.label}
        aria-current={isRailItemActive(pathname, RAIL_PROFILE.href) ? 'page' : undefined}
        className={cn(
          'mt-1.5 shrink-0 rounded-full ring-1 ring-border-default',
          'transition-[box-shadow] duration-(--motion-fast) ease-(--motion-ease-standard)',
          'hover:ring-border-strong',
        )}
      >
        <Avatar
          size="sm"
          name={user === null ? '' : displayName(user.first_name, user.last_name, user.id)}
          src={user?.avatar_url}
        />
      </Link>

      <button
        type="button"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={expanded}
        onClick={toggle}
        className={cn(RAIL_SLOT, 'mt-1 text-content-tertiary hover:bg-surface-inset hover:text-content-primary')}
      >
        {expanded ? <PanelLeftClose size={19} aria-hidden /> : <PanelLeftOpen size={19} aria-hidden />}
      </button>
    </nav>
  )
}
