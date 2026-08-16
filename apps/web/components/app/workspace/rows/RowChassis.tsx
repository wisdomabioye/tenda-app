/**
 * The selectable row every workspace list is built from (Tier 2 comp, lines
 * 451-475).
 *
 * One chassis, several fills: a conversation, an escrow, a notification and
 * an applicant differ only in what goes in each slot, so the selection
 * affordance, the unread pip, the truncation rules and the aria contract are
 * written once. A fifth variant fills slots — it does not touch this file.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface RowChassisProps {
  href: string
  /** The cursor is on this row (keyboard or pointer). */
  selected?: boolean
  /** Draws the unread pip and tells assistive tech the row is unread. */
  unread?: boolean
  /** Flashes once when a row arrives live, so movement is not silent. */
  arriving?: boolean
  /** Leading visual — an avatar, a category icon. */
  lead?: ReactNode
  /** Small line above the title: a name, a category. */
  eyebrow?: ReactNode
  /** Right-aligned timestamp, tabular. */
  time?: string
  title: string
  badge?: ReactNode
  subtitle?: ReactNode
  /** Money, rendered in the money tone. */
  amount?: string
  /**
   * Accessible name override. Rows pack several signals into one link, and
   * the raw text run ("Faridah • 2m • Design a flyer • OPEN • 120 USDC")
   * reads as noise; a variant can say it properly.
   */
  label?: string
}

export function RowChassis({
  href,
  selected = false,
  unread = false,
  arriving = false,
  lead,
  eyebrow,
  time,
  title,
  badge,
  subtitle,
  amount,
  label,
}: RowChassisProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'block rounded-card border p-3.5 transition-colors duration-(--motion-fast) ease-(--motion-ease-standard)',
        arriving && 'animate-arrive',
        selected
          ? 'border-border-strong bg-surface-card text-content-primary'
          : 'border-border-subtle bg-surface-card hover:border-border-strong',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {lead}
        {eyebrow !== undefined && (
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-[18px] text-content-secondary">
            {eyebrow}
          </span>
        )}
        {unread && (
          <>
            <span
              aria-hidden
              className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-primary"
            />
            {/* The pip is decorative; unread has to be sayable. */}
            <span className="sr-only">Unread</span>
          </>
        )}
        {time !== undefined && (
          <span className="shrink-0 whitespace-nowrap font-numeric text-[11px] leading-4 text-content-tertiary">
            {time}
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 font-display text-[15px] font-semibold leading-[21px] text-content-primary">
        {title}
      </p>

      {(badge !== undefined || subtitle !== undefined || amount !== undefined) && (
        <div className="mt-2 flex min-w-0 items-center gap-2.5">
          {badge}
          {subtitle !== undefined && (
            <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-content-tertiary">
              {subtitle}
            </span>
          )}
          {amount !== undefined && (
            <span className="shrink-0 whitespace-nowrap font-numeric text-[13px] font-bold leading-[18px] text-utility-money">
              {amount}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
