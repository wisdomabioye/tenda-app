import Link from 'next/link'
import { cn } from '@/lib/cn'
import { BrandMark } from './BrandMark'
import { HeaderSessionAction } from './HeaderSessionAction'

/**
 * Tier-1 public chrome (comp lines 371-388): wordmark, section nav, theme
 * toggle, way in.
 *
 * `apps/tendahq` remains the marketing surface — this header only orients and
 * offers the way in. The comp also links "Foundations"; that page does not
 * exist yet, and a nav pointing at a 404 is worse than a nav that waits.
 */

/** Where the wordmark points. `BrandMark`'s own default — kept in step below. */
const BRAND_HREF = '/gigs'

const NAV = [
  { href: '/gigs', label: 'Browse gigs' },
  { href: '/support', label: 'Support' },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-navbar backdrop-blur-[14px]">
      {/*
        `px-6` matches the hero and every section below, so the wordmark lines
        up with the headline — it is the measure, not spare room, and is NOT
        reduced on small screens. The GAP is what gives instead.

        This row cannot wrap and nothing in it shrinks, so anything that does
        not fit pushes the sign-in button past the viewport and scrolls the
        whole DOCUMENT sideways — which is what it did at 360px and 390px, the
        two commonest phone widths, until the rule below landed. Measured, not
        assumed; `e2e/public-discovery.spec.ts` now measures it too.
      */}
      <div className="mx-auto flex w-full max-w-content items-center gap-3 px-6 py-3.5 sm:gap-8">
        <BrandMark />
        <nav className="flex min-w-0 flex-1 items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-sm px-3 py-2 text-sm font-semibold text-content-secondary hover:bg-surface-inset hover:text-content-primary',
                // The wordmark already goes here. On a phone the row cannot
                // hold brand + both links + the way in, and a link that
                // duplicates a destination already on screen is the one to
                // drop — no affordance is lost, unlike hiding Support.
                item.href === BRAND_HREF && 'hidden sm:block',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <HeaderSessionAction />
      </div>
    </header>
  )
}
