/**
 * The support centre's sticky "All guides" rail (Tier 1 comp, lines 736-742).
 *
 * Driven by shared `SUPPORT_TOPICS` plus one entry for the index, so a topic
 * added to the shared vocabulary appears here without an edit — the same rule
 * the feed's category rail follows.
 *
 * `aria-current="page"` and not `aria-pressed`: these are links, and the
 * attribute for "this is the view you are on" is current. The token is `page`
 * here rather than the feed rail's `true` because these entries ARE pages,
 * which is the more specific and more useful announcement.
 */
import Link from 'next/link'
import { SUPPORT_TOPICS } from '@tenda/shared'
import { Eyebrow } from '@/components/ui'
import { cn } from '@/lib/cn'
import { SUPPORT_COPY } from './copy'

/** Every entry the rail offers, index first. `null` slug is the index. */
export const SUPPORT_NAV = [
  { slug: null, label: SUPPORT_COPY.navIndex, href: '/support' },
  ...SUPPORT_TOPICS.map((topic) => ({
    slug: topic.slug,
    label: topic.title,
    href: `/support/${topic.slug}`,
  })),
] as const

export function SupportNav({ current }: { current: string | null }) {
  return (
    <nav aria-label={SUPPORT_COPY.navLabel}>
      <Eyebrow className="mb-3">{SUPPORT_COPY.navLabel}</Eyebrow>
      <div className="flex flex-col gap-0.5">
        {SUPPORT_NAV.map((entry) => {
          const active = entry.slug === current
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-control px-2.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-control-selected-background text-content-primary'
                  : 'text-content-secondary hover:bg-surface-inset hover:text-content-primary',
              )}
            >
              {entry.label}
            </Link>
          )
        })}
      </div>
      <p className="mt-6 border-t border-border-subtle pt-5 text-[13px] leading-[18px] text-content-tertiary">
        {SUPPORT_COPY.stuckNote}{' '}
        <Link href="/settings" className="font-semibold text-content-link">
          {SUPPORT_COPY.stuckLink}
        </Link>
      </p>
    </nav>
  )
}
