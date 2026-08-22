import type { Metadata } from 'next'
import { APP_INFO } from '@tenda/shared'
import { FeedHero } from '@/components/gig/feed/FeedHero'
import { FeedKeyboard } from '@/components/gig/feed/FeedKeyboard'
import { FeedPager } from '@/components/gig/feed/FeedPager'
import { FeedRail } from '@/components/gig/feed/FeedRail'
import {
  FEED_GRID_CLASS,
  FeedEmpty,
  FeedErrorStatic,
  FeedPastEnd,
} from '@/components/gig/feed/FeedStates'
import { GigCard } from '@/components/gig/feed/GigCard'
import { FEED_COPY } from '@/components/gig/feed/copy'
import { listEnabledChains, listGigFacetsOnce, listGigsOnce } from '@/lib/gigs/data'
import {
  gigsHref,
  hasActiveFilters,
  parseGigFeedFilters,
  toGigFacetsQuery,
  toGigListQuery,
  type RawSearchParams,
} from '@/lib/gigs/search-params'

/**
 * A canonical per view, because the rail links a combinatorial URL space and
 * `robots.txt` allows all of it.
 *
 * `gigsHref` is the normalisation, reused rather than re-derived: it drops the
 * two POSITION keys and the redundant default sort, and keeps genuine filters.
 * So `/`, `/?offset=0` and `/?q=` — which serve byte-identical
 * rendered content today, verified — collapse to one address, while
 * `/?category=photo` stays its own page, which it is.
 *
 * Deliberately NOT a blanket `noindex` on filtered views: whether a category
 * or market slice deserves to rank is a product call, and a canonical makes no
 * claim either way. It only stops the same page from competing with itself.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}): Promise<Metadata> {
  const [params, chains] = await Promise.all([searchParams, listEnabledChains()])
  const filters = parseGigFeedFilters(params, new Set(chains.map((chain) => chain.id)))
  const page = await listGigsOnce(toGigListQuery(filters))
  return {
    title: 'Browse gigs',
    description: APP_INFO.description,
    alternates: { canonical: gigsHref(filters) },
    // An outage renders an honest error state at HTTP 200 (see the page), and
    // a 200 is indexable. This is the only thing standing between a crawler
    // and "We could not load the feed" as the front door's cached content.
    ...(page === null ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * Tier-1 public feed — server-rendered, anonymous, indexable. Every filter is
 * a URL search param, so the page needs no client JS to work and each
 * narrowed view has its own address. The one client component is the keyboard
 * walk, which renders nothing.
 */
export default async function PublicGigFeedPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [params, chains] = await Promise.all([searchParams, listEnabledChains()])
  const filters = parseGigFeedFilters(params, new Set(chains.map((chain) => chain.id)))
  // Concurrent: the rail's counts are a SECOND read, and awaiting them after
  // the feed would add their latency to a page that already has its content.
  const [page, facets] = await Promise.all([
    listGigsOnce(toGigListQuery(filters)),
    listGigFacetsOnce(toGigFacetsQuery(filters)),
  ])

  // Handled HERE rather than by `error.tsx`, which is a client component: its
  // fallback arrives with the hydration script, so a failed read rendered a
  // blank page for a reader with no JavaScript — measured, on the one surface
  // whose premise is that it works without the bundle. `error.tsx` stays for
  // anything thrown elsewhere in the tree. `generateMetadata` marks this
  // render noindex, since it answers 200.
  if (page === null) {
    return (
      <div className="mx-auto w-full max-w-content px-6 pb-20 pt-10">
        <FeedErrorStatic href={gigsHref(filters)} />
      </div>
    )
  }

  const heading = filters.q === null ? FEED_COPY.feed.heading : FEED_COPY.feed.searchHeading

  return (
    <>
      <FeedHero />
      <div className="mx-auto w-full max-w-content px-6 pb-20 pt-8">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-12">
          <FeedRail filters={filters} chains={chains} facets={facets} />

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
              // An empty page with matches behind it is a POSITION problem,
              // not a filter one — a stale page-three link, or a cursor whose
              // anchor row has since been taken. Saying "nothing matches" there
              // would be false, and clearing the filters would throw away the
              // search that did match. `gigsHref` with no changes rewinds both
              // position keys and keeps every filter.
              page.total > 0 ? (
                <FeedPastEnd href={gigsHref(filters)} total={page.total} />
              ) : (
                <FeedEmpty filtered={hasActiveFilters(filters)} />
              )
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
