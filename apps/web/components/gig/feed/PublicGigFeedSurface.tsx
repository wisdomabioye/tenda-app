'use client'

import { useState } from 'react'
import type { GigListQuery, PaginatedResponse } from '@tenda/shared'
import { usePublicGigFeedRealtime } from '@/hooks/gig/usePublicGigFeedRealtime'
import { gigsHref, hasActiveFilters, type GigFeedFilters } from '@/lib/gigs/search-params'
import { FeedKeyboard } from './FeedKeyboard'
import { FeedPager } from './FeedPager'
import { FEED_GRID_CLASS, FeedEmpty, FeedPastEnd } from './FeedStates'
import { GigCard } from './GigCard'
import { FEED_COPY } from './copy'
import type { GigCardModel } from './gig-card-model'

export function PublicGigFeedSurface({ page, filters, query }: {
  page: PaginatedResponse<GigCardModel>
  filters: GigFeedFilters
  query: GigListQuery
}) {
  const surfaceKey = JSON.stringify([
    query,
    page.total,
    page.next_cursor,
    page.data.map((gig) => [gig.escrow_id, gig.public_feed_revision]),
  ])
  return <PublicGigFeedState key={surfaceKey} page={page} filters={filters} query={query} />
}

function PublicGigFeedState({ page, filters, query }: {
  page: PaginatedResponse<GigCardModel>
  filters: GigFeedFilters
  query: GigListQuery
}) {
  const [live, setLive] = useState({ items: page.data, total: page.total })
  const applyItems = (items: GigCardModel[], membershipDelta: number) => setLive((current) => ({
    items,
    total: Math.max(0, current.total + membershipDelta),
  }))
  usePublicGigFeedRealtime({ items: live.items, query, applyItems })

  const heading = filters.q === null ? FEED_COPY.feed.heading : FEED_COPY.feed.searchHeading
  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border-subtle pb-4">
        <h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.4px] text-content-primary">{heading}</h2>
        <p className="font-numeric text-[13px] leading-[18px] text-content-tertiary">{FEED_COPY.feed.count(live.total)}</p>
      </div>
      {live.items.length === 0 ? (
        live.total > 0
          ? <FeedPastEnd href={gigsHref(filters)} total={live.total} />
          : <FeedEmpty filtered={hasActiveFilters(filters)} />
      ) : (
        <>
          <ul className={FEED_GRID_CLASS}>
            {live.items.map((gig, index) => <li key={gig.escrow_id} className="flex"><GigCard gig={gig} index={index} /></li>)}
          </ul>
          <p className="mt-6 text-[13px] leading-[18px] text-content-tertiary">{FEED_COPY.feed.amountNote}</p>
          <FeedPager filters={filters} nextCursor={page.next_cursor} total={live.total} shown={live.items.length} />
          <FeedKeyboard />
        </>
      )}
    </section>
  )
}
