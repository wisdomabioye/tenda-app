import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { RailBadge } from './RailBadge'

/** Shared 40px slot geometry — every rail control sits on the same grid. */
export const RAIL_SLOT =
  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-control transition-colors duration-(--motion-fast) ease-(--motion-ease-standard)'

interface RailLinkProps {
  href: string
  /** The rail is icon-only, so this is the control's entire accessible name. */
  label: string
  icon: LucideIcon
  active?: boolean
  /** Unread count; 0 or less renders no pip. */
  badgeCount?: number
}

export function RailLink({ href, label, icon: Icon, active = false, badgeCount = 0 }: RailLinkProps) {
  // The count belongs in the accessible name, not only in the visual pip —
  // the pip itself is aria-hidden.
  const accessibleName = badgeCount > 0 ? `${label}, ${badgeCount} unread` : label
  return (
    <Link
      href={href}
      aria-label={accessibleName}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        RAIL_SLOT,
        active
          ? 'bg-control-selected-background text-brand-primary'
          : 'text-content-tertiary hover:bg-surface-inset hover:text-content-primary',
      )}
    >
      <Icon size={20} aria-hidden />
      <RailBadge count={badgeCount} />
    </Link>
  )
}
