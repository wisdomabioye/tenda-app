'use client'

/**
 * Search + sort, as one GET form to the root feed.
 *
 * A form and not a router.push: with no JavaScript, Enter in the search box
 * still submits and the `<noscript>` button still applies a sort — the feed's
 * whole point is that it works for a visitor who has not signed in and may be
 * on a browser that never ran our bundle. The client half is enhancement
 * only: it submits on sort change so the select behaves like the comp's,
 * which fires onChange.
 *
 * Filters the form has no input for (category, market, chain, arrangement)
 * ride along as hidden fields. Without them a search would silently clear the
 * category the user picked one control above.
 */
import { useRef } from 'react'
import { Search } from 'lucide-react'
import {
  GIG_SORTS,
  GIG_SORT_LABELS,
  type GigFeedFilters,
} from '@/lib/gigs/search-params'
import { RailSection } from './RailSection'
import { FEED_COPY } from './copy'

/** The filters carried as hidden fields, in a stable order. */
function hiddenFields(filters: GigFeedFilters): Array<[string, string]> {
  const fields: Array<[string, string]> = []
  if (filters.category !== null) fields.push(['category', filters.category])
  if (filters.country !== null) fields.push(['country', filters.country])
  if (filters.city !== null) fields.push(['city', filters.city])
  if (filters.chain_id !== null) fields.push(['chain_id', filters.chain_id])
  if (filters.remote) fields.push(['remote', 'true'])
  if (filters.cross_border) fields.push(['cross_border', 'true'])
  return fields
}

export function FeedRailForm({ filters }: { filters: GigFeedFilters }) {
  const form = useRef<HTMLFormElement>(null)

  return (
    <form ref={form} method="get" action="/" className="flex flex-col gap-7">
      {hiddenFields(filters).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <RailSection label={FEED_COPY.rail.search} htmlFor="gig-q">
        <div className="flex items-center gap-2 rounded-control border border-border-input bg-control-input-background px-3 focus-within:border-border-input-active">
          <Search size={16} aria-hidden className="shrink-0 text-content-tertiary" />
          <input
            id="gig-q"
            type="search"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder={FEED_COPY.rail.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-control-input-text outline-none placeholder:text-control-input-placeholder"
          />
        </div>
      </RailSection>

      <RailSection label={FEED_COPY.rail.sort} htmlFor="gig-sort">
        <select
          id="gig-sort"
          name="sort"
          defaultValue={filters.sort === 'created_at' ? '' : filters.sort}
          onChange={() => form.current?.requestSubmit()}
          className="w-full rounded-control border border-border-input bg-control-input-background px-3 py-2.5 text-sm text-control-input-text"
        >
          {GIG_SORTS.map((sort) => (
            // The default ordering submits as an EMPTY value so the canonical
            // feed keeps one address (see gigsHref) — and, on the wire, its
            // keyset cursor (see toGigListQuery).
            <option key={sort} value={sort === 'created_at' ? '' : sort}>
              {GIG_SORT_LABELS[sort]}
            </option>
          ))}
        </select>
      </RailSection>

      <noscript>
        <button
          type="submit"
          className="rounded-control bg-brand-solid px-4 py-2 text-sm font-bold text-brand-on-primary"
        >
          {FEED_COPY.rail.apply}
        </button>
      </noscript>
    </form>
  )
}
