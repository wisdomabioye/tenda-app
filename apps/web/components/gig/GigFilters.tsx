import Link from 'next/link'
import { CATEGORY_LABELS, GIG_CATEGORIES } from '@tenda/shared'
import type { GigChainOption } from '@/lib/gigs/data'
import { gigsHref, type GigFeedFilters } from '@/lib/gigs/search-params'

/**
 * Filter rail. Everything is a link or a GET form — filters ARE the URL, so
 * every filtered view is linkable and indexable, and the rail works with no
 * client JS at all.
 */
export function GigFilters({ filters, chains }: { filters: GigFeedFilters; chains: GigChainOption[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <FilterChip href={gigsHref(filters, { category: null })} active={filters.category === null}>
          All
        </FilterChip>
        {GIG_CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            href={gigsHref(filters, { category })}
            active={filters.category === category}
          >
            {CATEGORY_LABELS[category]}
          </FilterChip>
        ))}
        <FilterChip href={gigsHref(filters, { remote: filters.remote ? null : 'true' })} active={filters.remote}>
          Remote
        </FilterChip>
      </div>

      <form method="get" action="/gigs" className="flex flex-wrap items-center gap-3">
        {/* Active category/remote survive a search submit as hidden fields. */}
        {filters.category !== null && <input type="hidden" name="category" value={filters.category} />}
        {filters.remote && <input type="hidden" name="remote" value="true" />}
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Search gigs"
          className="min-w-40 flex-1 rounded-control border border-border-input bg-control-input-background px-4 py-2 text-sm text-control-input-text placeholder:text-control-input-placeholder focus:border-border-input-active focus:outline-none"
        />
        <input
          type="text"
          name="city"
          defaultValue={filters.city ?? ''}
          placeholder="City"
          className="w-32 rounded-control border border-border-input bg-control-input-background px-4 py-2 text-sm text-control-input-text placeholder:text-control-input-placeholder focus:border-border-input-active focus:outline-none"
        />
        {chains.length > 0 && (
          <select
            name="chain_id"
            defaultValue={filters.chain_id ?? ''}
            aria-label="Chain"
            className="rounded-control border border-border-input bg-control-input-background px-3 py-2 text-sm text-control-input-text focus:border-border-input-active focus:outline-none"
          >
            <option value="">All chains</option>
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-control bg-brand-solid px-5 py-2 text-sm font-semibold text-brand-on-primary hover:bg-brand-primary-pressed"
        >
          Filter
        </button>
      </form>
    </div>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={
        active
          ? 'rounded-full bg-brand-solid px-4 py-1 text-sm font-semibold text-brand-on-primary'
          : 'rounded-full border border-border-default bg-surface-card px-4 py-1 text-sm font-semibold text-content-secondary hover:border-border-strong hover:text-content-primary'
      }
    >
      {children}
    </Link>
  )
}
