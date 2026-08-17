/**
 * The detail's opening block (Tier 1 comp, lines 571-599): breadcrumb,
 * taxonomy line, headline, and the three facts a reader checks before
 * scrolling — where, when, and whether it crosses a border.
 */
import Link from 'next/link'
import {
  CATEGORY_LABELS,
  formatRelativeShort,
  gigPlaceLabel,
  type GigDetail,
} from '@tenda/shared'
import { ChevronRight, Clock, Globe, MapPin } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_TONE } from '@/components/gig/category-icons'
import { Eyebrow } from '@/components/ui'
import { gigsHref, parseGigFeedFilters } from '@/lib/gigs/search-params'
import { GIG_DETAIL_COPY } from './copy'

/**
 * The category crumb links to the FEED filtered by that category — the comp's
 * `categoryHref`. Built through gigsHref off an empty filter set so the link
 * obeys the same URL contract as the rail, rather than being hand-assembled
 * into a query string that could drift from it.
 */
function categoryHref(gig: GigDetail): string {
  return gigsHref(parseGigFeedFilters({}, new Set()), { category: gig.category })
}

export function GigDetailHeader({ gig }: { gig: GigDetail }) {
  const CategoryIcon = CATEGORY_ICONS[gig.category]
  const tone = CATEGORY_TONE[gig.category]

  return (
    <header>
      <nav
        aria-label="Breadcrumb"
        className="mb-7 flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-content-tertiary"
      >
        <Link href="/gigs" className="font-semibold text-content-tertiary hover:text-content-primary">
          {GIG_DETAIL_COPY.breadcrumbRoot}
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link
          href={categoryHref(gig)}
          className="font-semibold text-content-tertiary hover:text-content-primary"
        >
          {CATEGORY_LABELS[gig.category]}
        </Link>
        <ChevronRight size={14} aria-hidden />
        {/* The escrow id is the thing a reader quotes to support, so it is
            shown in full and in mono rather than truncated to look tidy. */}
        <span className="break-all font-numeric text-xs">{gig.escrow_id}</span>
      </nav>

      <div className="flex items-center gap-2.5">
        <CategoryIcon size={18} aria-hidden className={`shrink-0 ${tone.text}`} />
        <Eyebrow as="span" className={tone.text}>
          {CATEGORY_LABELS[gig.category]}
        </Eyebrow>
      </div>

      {/* Poster-written, and set at 44px — the width a single unbroken token
          needs here is enormous. `break-words` only acts when it would
          otherwise overflow. See CLAUDE.md, "text a poster wrote". */}
      <h1 className="mt-5 text-balance break-words font-display text-[32px] font-bold leading-[38px] tracking-[-1.2px] text-content-primary sm:text-[44px] sm:leading-[50px]">
        {gig.title}
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-5 text-content-secondary">
        {/* `city` is free text a poster typed, so this chip has to survive a
            57-character place name. It BREAKS rather than truncates: on the
            detail page the location is a fact the reader is deciding on, and
            half of it is worse than a taller line. */}
        <span className="flex min-w-0 items-center gap-2">
          <MapPin size={16} aria-hidden className="shrink-0 text-content-tertiary" />
          <span className="min-w-0 break-words">{gigPlaceLabel(gig)}</span>
        </span>
        {gig.created_at !== null && (
          <span className="flex items-center gap-2">
            <Clock size={16} aria-hidden className="text-content-tertiary" />
            {GIG_DETAIL_COPY.postedPrefix}{' '}
            <span className="font-numeric">{formatRelativeShort(gig.created_at)}</span>
          </span>
        )}
        {gig.cross_border && (
          <span className="flex items-center gap-2 rounded-full border border-feedback-info-border bg-feedback-info-surface px-3 py-1 text-[13px] font-semibold text-feedback-info-text">
            <Globe size={14} aria-hidden />
            {GIG_DETAIL_COPY.crossBorder}
          </span>
        )}
      </div>
    </header>
  )
}
