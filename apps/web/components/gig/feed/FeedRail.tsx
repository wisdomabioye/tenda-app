/**
 * The feed's filter rail (Tier 1 comp, lines 404-472): search, category,
 * market, arrangement, sort, clear.
 *
 * Every control is a link or a form field, so the whole rail works with no
 * client JavaScript and each narrowed view has its own address.
 *
 * The comp puts a COUNT beside each category and toggle. They come from
 * GET /v1/gigs/facets — one request answering every cell, sharing the feed's
 * own base conditions server-side so a number can never disagree with the list
 * beside it. `facets` is null when that read failed, and every cell then draws
 * without a number rather than claiming zero.
 *
 * The MARKET chips carry no count: the comp draws none there, and the chip has
 * no room for one. The endpoint answers per-country all the same, so wiring
 * them is a comp decision rather than another round trip.
 */
import { CATEGORY_LABELS, GIG_CATEGORIES, type GigFacets } from '@tenda/shared'
import type { GigChainOption } from '@/lib/gigs/data'
import { CATEGORY_TONE } from '@/components/gig/category-icons'
import { marketNames } from '@/lib/markets'
import { gigsHref, hasActiveFilters, GIG_MARKETS, type GigFeedFilters } from '@/lib/gigs/search-params'
import Link from 'next/link'
import { FilterChip, FilterRow } from './FilterLink'
import { FeedRailForm } from './FeedRailForm'
import { RailSection } from './RailSection'
import { FEED_COPY } from './copy'

/** Resolved once: the vocabulary is a module constant, not per-render data. */
const MARKET_NAMES = marketNames(GIG_MARKETS)

export function FeedRail({
  filters,
  chains,
  facets = null,
}: {
  filters: GigFeedFilters
  chains: readonly GigChainOption[]
  /** Null when the counts could not be read; the rail simply omits them. */
  facets?: GigFacets | null
}) {
  return (
    <aside
      aria-label="Filter gigs"
      className="flex flex-col gap-7 lg:sticky lg:top-[88px]"
    >
      <FeedRailForm filters={filters} />

      <RailSection label={FEED_COPY.rail.category}>
        <div className="flex flex-col gap-1">
          <FilterRow href={gigsHref(filters, { category: null })} active={filters.category === null}>
            {FEED_COPY.rail.allCategories}
          </FilterRow>
          {GIG_CATEGORIES.map((category) => (
            <FilterRow
              key={category}
              href={gigsHref(filters, { category })}
              active={filters.category === category}
              dotClassName={CATEGORY_TONE[category].dot}
              count={facets?.category[category]}
            >
              {CATEGORY_LABELS[category]}
            </FilterRow>
          ))}
        </div>
      </RailSection>

      <RailSection label={FEED_COPY.rail.market}>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip href={gigsHref(filters, { country: null })} active={filters.country === null}>
            {FEED_COPY.rail.allMarkets}
          </FilterChip>
          {GIG_MARKETS.map((code, index) => (
            <FilterChip
              key={code}
              href={gigsHref(filters, { country: code })}
              active={filters.country === code}
            >
              {MARKET_NAMES[index]}
            </FilterChip>
          ))}
        </div>
      </RailSection>

      <RailSection label={FEED_COPY.rail.arrangement}>
        <div className="flex flex-col gap-1.5">
          {/* Toggles, so a second click clears them — the comp's aria-pressed
              buttons with a filter's URL semantics. */}
          <FilterRow
            href={gigsHref(filters, { remote: filters.remote ? null : 'true' })}
            active={filters.remote}
            count={facets?.remote}
          >
            {FEED_COPY.rail.remote}
          </FilterRow>
          <FilterRow
            href={gigsHref(filters, { cross_border: filters.cross_border ? null : 'true' })}
            active={filters.cross_border}
            count={facets?.cross_border}
          >
            {FEED_COPY.rail.crossBorder}
          </FilterRow>
        </div>
      </RailSection>

      {/* Only the chains this deployment actually serves; an unserved id is a
          400, so an empty registry hides the section rather than offering one. */}
      {chains.length > 0 && (
        <RailSection label={FEED_COPY.rail.chain}>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              href={gigsHref(filters, { chain_id: null })}
              active={filters.chain_id === null}
            >
              {FEED_COPY.rail.allChains}
            </FilterChip>
            {chains.map((chain) => (
              <FilterChip
                key={chain.id}
                href={gigsHref(filters, { chain_id: chain.id })}
                active={filters.chain_id === chain.id}
              >
                {chain.label}
              </FilterChip>
            ))}
          </div>
        </RailSection>
      )}

      {hasActiveFilters(filters) && (
        <Link
          href="/gigs"
          className="self-start text-[13px] font-semibold text-brand-primary underline"
        >
          {FEED_COPY.rail.clear}
        </Link>
      )}

      <p className="border-t border-border-subtle pt-5 text-[13px] leading-[18px] text-content-tertiary">
        <Kbd>j</Kbd> <Kbd>k</Kbd> {FEED_COPY.feed.keyboardHint.walk}, <Kbd>Enter</Kbd>{' '}
        {FEED_COPY.feed.keyboardHint.open}.
      </p>
    </aside>
  )
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-[6px] border border-border-default bg-surface-inset px-1.5 py-px font-numeric text-xs">
      {children}
    </kbd>
  )
}
