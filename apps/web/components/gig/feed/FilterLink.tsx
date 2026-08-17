/**
 * The rail's two selectable shapes: a full-width ROW (category, arrangement)
 * and a compact CHIP (market). Both are links, never buttons — a filter is a
 * URL here, so every narrowed view is linkable, indexable, and survives the
 * back button with no client state at all.
 *
 * `aria-current="true"` rather than the comps' `aria-pressed`: pressed
 * describes a toggle BUTTON, and announcing a link as pressed tells a screen
 * reader user the wrong control is under them. Current is the attribute for
 * "this is the view you are on".
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function FilterRow({
  href,
  active,
  dotClassName,
  children,
}: {
  href: string
  active: boolean
  /** Category tone dot. Omitted where the row has no taxonomy colour. */
  dotClassName?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-control-selected-background text-content-primary'
          : 'text-content-secondary hover:bg-surface-inset hover:text-content-primary',
      )}
    >
      {dotClassName !== undefined && (
        <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', dotClassName)} />
      )}
      <span className="flex-1 text-left">{children}</span>
    </Link>
  )
}

export function FilterChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors',
        active
          ? 'border-control-selected-border bg-control-selected-background text-brand-primary'
          : 'border-border-default bg-surface-card text-content-secondary hover:border-border-strong hover:text-content-primary',
      )}
    >
      {children}
    </Link>
  )
}
