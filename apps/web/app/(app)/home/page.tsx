'use client'

/**
 * Authed home feed (mobile's (tabs)/home analogue). Client-fetched — the
 * bearer lives in localStorage, invisible to the server render (CLAUDE.md
 * data-access policy). First page only; pagination arrives with the shared
 * usePaginatedList port in later stages.
 */
import { useEffect, useState } from 'react'
import type { GigSummary } from '@tenda/shared'
import { api } from '@/api/client'
import { GigCard } from '@/components/gig/feed/GigCard'
import { FEED_GRID_CLASS, FeedError, FeedSkeleton } from '@/components/gig/feed/FeedStates'
import { GIGS_PAGE_SIZE } from '@/lib/gigs/search-params'

type FeedState =
  | { phase: 'loading' }
  | { phase: 'ready'; gigs: GigSummary[]; total: number }
  | { phase: 'error' }

export default function HomePage() {
  const [state, setState] = useState<FeedState>({ phase: 'loading' })

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.gigs
      .list({ limit: GIGS_PAGE_SIZE })
      .then((page) => {
        if (!cancelled) setState({ phase: 'ready', gigs: page.data, total: page.total })
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function retry() {
    setState({ phase: 'loading' })
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-content-primary">Home</h1>
        <p className="text-sm text-content-secondary">Open gigs you can take right now.</p>
      </header>

      {/* The same async states as the public feed. /home fetches in the
          browser, so a skeleton here needs no Suspense boundary — unlike
          /gigs, where one would have made the content JavaScript-dependent. */}
      {state.phase === 'loading' && (
        <div aria-busy="true">
          <FeedSkeleton count={3} />
        </div>
      )}

      {state.phase === 'error' && <FeedError retry={retry} />}

      {state.phase === 'ready' &&
        (state.gigs.length === 0 ? (
          <div className="rounded-card border border-border-subtle bg-surface-card px-5 py-10 text-center">
            <p className="font-display text-lg font-semibold text-content-primary">No open gigs right now</p>
            <p className="mt-2 text-sm text-content-secondary">New gigs are posted all the time — check back soon.</p>
          </div>
        ) : (
          <ul className={FEED_GRID_CLASS}>
            {state.gigs.map((gig, index) => (
              <li key={gig.escrow_id} className="flex">
                <GigCard gig={gig} index={index} />
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
