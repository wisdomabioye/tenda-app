/**
 * The section label. It appears above nearly every block in all six comps —
 * a rail heading, a card's "LOCKED IN ESCROW", a dossier's "AMOUNT", the
 * feed's market line — always with the same letterforms and always
 * subordinate to what it labels.
 *
 * The comps set it mono/0.13em; since spec-correction #44 (2026-08-24) it is
 * the body face at 0.08em — the mono-uppercase label everywhere was the
 * largest single contributor to the retired newsprint look, and the figures
 * keep mono to themselves.
 *
 * A primitive rather than a repeated class string because the tracking is
 * the part that drifts: it was already written seventeen ways across this
 * app, and a label set at 0.1em beside one set at 0.08em reads as a mistake
 * without anyone being able to say which one is wrong.
 *
 * `as` exists because the same visual is sometimes a heading in the document
 * outline (a section's title) and sometimes just a label (a figure's caption).
 * Picking the tag by how it LOOKS is how screen-reader outlines fill up with
 * headings nobody meant to publish.
 */
import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type EyebrowTone = 'tertiary' | 'secondary' | 'warning' | 'brand' | 'input'

const TONE_CLASSES: Record<EyebrowTone, string> = {
  tertiary: 'text-content-tertiary',
  secondary: 'text-content-secondary',
  warning: 'text-feedback-warning-text',
  brand: 'text-brand-primary',
  /**
   * Form-field labels. The comps set these in `content-tertiary` like every
   * other eyebrow; the generated `control-input-label` is the same hue two
   * steps darker (7.19:1 against the page, against tertiary's 5.12:1), and a
   * label you are about to type under is worth the darker one.
   */
  input: 'text-control-input-label',
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
        'uppercase tracking-[0.08em]',
        // leading-4 AFTER the size, never in the base string: tailwind-merge
        // treats a later font-size as conflicting with an earlier leading-*
        // (font-size can set line-height) and silently drops it — and
        // text-[11px] brings no line-height of its own, so the strong label
        // would inherit ~1.5 instead of the designed 16px box.
        strong ? 'text-[11px] font-bold leading-4' : 'text-xs font-medium leading-4',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </Tag>
  )
}
