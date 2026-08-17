import type { Metadata } from 'next'
import { APP_INFO } from '@tenda/shared'
import { FeedHero } from '@/components/gig/feed/FeedHero'
import { FeedKeyboard } from '@/components/gig/feed/FeedKeyboard'
import { FeedPager } from '@/components/gig/feed/FeedPager'
import { FeedRail } from '@/components/gig/feed/FeedRail'
import { FEED_GRID_CLASS, FeedEmpty } from '@/components/gig/feed/FeedStates'
import { GigCard } from '@/components/gig/feed/GigCard'
import { FEED_COPY } from '@/components/gig/feed/copy'
import { listEnabledChains, listGigs } from '@/lib/gigs/data'
import {
  hasActiveFilters,
  parseGigFeedFilters,
  toGigListQuery,
  type RawSearchParams,
} from '@/lib/gigs/search-params'

export const metadata: Metadata = {
  title: 'Browse gigs',
  description: APP_INFO.description,
}

/**
 * Tier-1 public feed — server-rendered, anonymous, indexable. Every filter is
 * a URL search param, so the page needs no client JS to work and each
 * narrowed view has its own address. The one client component is the keyboard
 * walk, which renders nothing.
 */
export default async function GigsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [params, chains] = await Promise.all([searchParams, listEnabledChains()])
  const filters = parseGigFeedFilters(params, new Set(chains.map((chain) => chain.id)))
  const page = await listGigs(toGigListQuery(filters))

  const heading = filters.q === null ? FEED_COPY.feed.heading : FEED_COPY.feed.searchHeading

  return (
    <>
      <FeedHero />
      <div className="mx-auto w-full max-w-content px-6 pb-20 pt-8">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-12">
          <FeedRail filters={filters} chains={chains} />

          <section>
            <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border-subtle pb-4">
              <h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.4px] text-content-primary">
                {heading}
              </h2>
              {/* `total` is the whole filtered set, not this page — the count
                  a reader wants is "how much is there", not "how much did we
                  send you". */}
              <p className="font-numeric text-[13px] leading-[18px] text-content-tertiary">
                {FEED_COPY.feed.count(page.total)}
              </p>
            </div>

            {page.data.length === 0 ? (
              <FeedEmpty filtered={hasActiveFilters(filters)} />
            ) : (
              <>
                <ul className={FEED_GRID_CLASS}>
                  {page.data.map((gig, index) => (
                    <li key={gig.escrow_id} className="flex">
                      <GigCard gig={gig} index={index} />
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[13px] leading-[18px] text-content-tertiary">
                  {FEED_COPY.feed.amountNote}
                </p>
                <FeedPager
                  filters={filters}
                  nextCursor={page.next_cursor}
                  total={page.total}
                  shown={page.data.length}
                />
                <FeedKeyboard />
              </>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
