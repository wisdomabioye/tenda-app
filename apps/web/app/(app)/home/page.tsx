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
import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { DashboardGigRow } from '@/components/home/DashboardGigRow'
import { HomeGigSkeleton } from '@/components/home/HomeGigSkeleton'
import { FeedError } from '@/components/gig/feed/FeedStates'
import { buttonVariants } from '@/components/ui'
import { ROUTES } from '@/lib/routes'

const HOME_GIG_LIMIT = 6

type FeedState =
  | { phase: 'loading' }
  | { phase: 'ready'; gigs: GigSummary[] }
  | { phase: 'error' }

export default function HomePage() {
  const [state, setState] = useState<FeedState>({ phase: 'loading' })

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.gigs
      .list({ limit: HOME_GIG_LIMIT })
      .then((page) => {
        if (!cancelled) setState({ phase: 'ready', gigs: page.data })
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
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Workspace</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-content-primary sm:text-3xl">Home</h1>
          <p className="mt-1 text-sm text-content-secondary">Open work and the shortest path to your next action.</p>
        </div>
        <Link href={ROUTES.create} className={buttonVariants({ size: 'md' })}>
          <Plus size={16} aria-hidden /> Create
        </Link>
      </header>

      <section className="overflow-hidden rounded-card border border-border-subtle bg-surface-card shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5">
          <div>
            <h2 className="font-display text-base font-semibold text-content-primary">Open gigs</h2>
            <p className="mt-0.5 text-xs text-content-tertiary">Recently posted work you can take.</p>
          </div>
          <Link href={ROUTES.gigs} className="flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline">
            Browse all <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        {state.phase === 'loading' && <HomeGigSkeleton />}
        {state.phase === 'error' && <div className="p-4"><FeedError retry={retry} /></div>}
        {state.phase === 'ready' &&
        (state.gigs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-display text-lg font-semibold text-content-primary">No open gigs right now</p>
            <p className="mt-2 text-sm text-content-secondary">New gigs are posted all the time — check back soon.</p>
          </div>
        ) : (
          <ul>
            {state.gigs.map((gig) => (
              <li key={gig.escrow_id}>
                <DashboardGigRow gig={gig} />
              </li>
            ))}
          </ul>
        ))}
      </section>
    </div>
  )
}
