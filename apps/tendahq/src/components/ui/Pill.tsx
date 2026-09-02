import type { ReactNode } from 'react'
import type { CategoryId } from '@/content/categories'
import { cn } from '@/lib/cn'

/**
 * `live` is mobile's LiveChip: a success-green dot beside tertiary text. The
 * feedback tones tint the dot only — the chip itself stays a hairline pill,
 * because on this page a coloured fill is what a gig CATEGORY looks like and
 * nothing else may borrow that.
 */
export type PillTone = 'neutral' | 'brand' | 'live' | 'warning' | 'danger'

interface Props {
  children: ReactNode
  tone?: PillTone
  /** Show the leading 6px dot, tinted by the tone. */
  dot?: boolean
  /** Breathe the dot: a live status, or the hero stamp naming the chains in build. */
  pulse?: boolean
  /**
   * A gig category chip: the app's own category tone as a soft fill, in the
   * body face rather than mono, exactly as mobile draws a category.
   */
  category?: CategoryId
  className?: string
}

const DOT: Record<PillTone, string> = {
  neutral: 'bg-[var(--content-tertiary)]',
  brand:   'bg-[var(--brand)]',
  live:    'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger:  'bg-[var(--danger)]',
}

const CATEGORY: Record<CategoryId, string> = {
  delivery: 'bg-[var(--cat-delivery-surface)] text-[var(--cat-delivery-text)]',
  photo:    'bg-[var(--cat-photo-surface)] text-[var(--cat-photo-text)]',
  errand:   'bg-[var(--cat-errand-surface)] text-[var(--cat-errand-text)]',
  service:  'bg-[var(--cat-service-surface)] text-[var(--cat-service-text)]',
  digital:  'bg-[var(--cat-digital-surface)] text-[var(--cat-digital-text)]',
}

/**
 * Mobile's Chip.tsx: a 26px pill carrying the Eyebrow face (mono 9.5 / 600 /
 * +0.95, uppercase) inside a hairline. The one thing on the page that IS a
 * pill.
 */
export function Pill({
  children,
  tone = 'neutral',
  dot = false,
  pulse = false,
  category,
  className,
}: Props) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-[7px] whitespace-nowrap rounded-full border px-[11px]',
        category === undefined
          ? 'eyebrow border-[var(--border-default)] text-[var(--content-tertiary)]'
          : cn('label border-transparent', CATEGORY[category]),
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full',
            DOT[tone],
            pulse && 'motion-safe:animate-[live-ping_2.8s_cubic-bezier(0.2,0,0,1)_infinite]',
          )}
        />
      )}
      {children}
    </span>
  )
}
