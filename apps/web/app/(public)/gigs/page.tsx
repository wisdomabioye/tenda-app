import type { Metadata } from 'next'
import { APP_INFO } from '@tenda/shared'
import Link from 'next/link'
import { GigCard } from '@/components/gig/GigCard'
import { GigFilters } from '@/components/gig/GigFilters'
import { listEnabledChains, listGigs } from '@/lib/gigs/data'
import {
  gigsHref,
  parseGigFeedFilters,
  toGigListQuery,
  type RawSearchParams,
} from '@/lib/gigs/search-params'

export const metadata: Metadata = {
  title: 'Browse gigs',
  description: APP_INFO.description,
}

/**
 * Tier-1 public feed — server-rendered, anonymous, indexable. All filtering
 * is URL search params; content requires no client JS (stage-1 DoD).
 */
export default async function GigsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [params, chains] = await Promise.all([searchParams, listEnabledChains()])
  const filters = parseGigFeedFilters(params, new Set(chains.map((chain) => chain.id)))
  const page = await listGigs(toGigListQuery(filters))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-content-primary">Browse gigs</h1>
        <p className="text-content-secondary">
          Every gig is escrow-secured — funds are locked on-chain before work starts.
        </p>
      </header>

      <GigFilters filters={filters} chains={chains} />

      {page.data.length === 0 ? (
        <div className="rounded-card border border-border-subtle bg-surface-card px-5 py-10 text-center">
          <p className="font-display text-lg font-semibold text-content-primary">No gigs match</p>
          <p className="mt-2 text-sm text-content-secondary">
            Try clearing a filter — new gigs are posted all the time.
          </p>
          <Link href="/gigs" className="mt-4 inline-block text-sm font-semibold text-content-link">
            Clear all filters
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {page.data.map((gig) => (
            <li key={gig.escrow_id}>
              <GigCard gig={gig} />
            </li>
          ))}
        </ul>
      )}

      {typeof page.next_cursor === 'string' && page.next_cursor !== '' && (
        <Link
          href={gigsHref(filters, { cursor: page.next_cursor })}
          className="self-center rounded-control border border-border-default bg-surface-card px-6 py-3 text-sm font-semibold text-content-secondary hover:border-border-strong hover:text-content-primary"
        >
          More gigs
        </Link>
      )}
    </div>
  )
}
