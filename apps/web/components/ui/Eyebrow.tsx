/**
 * The comps' section label: mono, uppercase, 0.13em tracking. It appears
 * above nearly every block in all six comps — a rail heading, a card's
 * "LOCKED IN ESCROW", a dossier's "AMOUNT", the feed's market line — always
 * with the same letterforms and always subordinate to what it labels.
 *
 * A primitive rather than a repeated class string because the tracking is
 * the part that drifts: it was already written seventeen ways across this
 * app, and a label set at 0.1em beside one set at 0.13em reads as a mistake
 * without anyone being able to say which one is wrong.
 *
 * `as` exists because the same visual is sometimes a heading in the document
 * outline (a section's title) and sometimes just a label (a figure's caption).
 * Picking the tag by how it LOOKS is how screen-reader outlines fill up with
 * headings nobody meant to publish.
 */
import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type EyebrowTone = 'tertiary' | 'secondary' | 'warning' | 'brand'

const TONE_CLASSES: Record<EyebrowTone, string> = {
  tertiary: 'text-content-tertiary',
  secondary: 'text-content-secondary',
  warning: 'text-feedback-warning-text',
  brand: 'text-brand-primary',
}

export function Eyebrow({
  as: Tag = 'p',
  tone = 'tertiary',
  strong = false,
  htmlFor,
  id,
  className,
  children,
}: {
  as?: ElementType
  tone?: EyebrowTone
  /** The comps' bolder 11px variant, used where the label carries a count. */
  strong?: boolean
  /** Only meaningful with `as="label"`; declared so it need not be spread in. */
  htmlFor?: string
  /** Target for an `aria-labelledby` when this eyebrow names a group. */
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tag
      htmlFor={htmlFor}
      id={id}
      className={cn(
        'font-numeric uppercase leading-4 tracking-[0.13em]',
        strong ? 'text-[11px] font-bold' : 'text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </Tag>
  )
}
