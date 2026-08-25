'use client'

/**
 * The signed-in workspace's list of open gigs.
 *
 * LIVE, off the same `feed:gigs` broadcast the anonymous feed reads and
 * through the same reduction — see `useGigFeedRealtime`. Before that it
 * fetched once on mount and never again, so a gig posted while the reader sat
 * here appeared only if they navigated away and back: measured as one
 * `/v1/gigs` request at first paint and still one after twenty seconds.
 *
 * Storing whole `GigSummary` rows, unlike the public feed's trimmed card
 * model, because the row renders the amount — that difference is exactly what
 * the reducer's `project` exists for.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { GigListQuery, GigSummary } from '@tenda/shared'
import { api } from '@/api/client'
import { ListColumn, type ListGroup } from '@/components/app/workspace/list'
import { EscrowRow } from '@/components/app/workspace/rows'
import { gigRowSubtitle } from '@/components/gig/my-gigs/row-subtitle'
import { useGigFeedRealtime } from '@/hooks/gig/useGigFeedRealtime'
import { useCommandPalette } from '@/hooks/workspace/useCommandPalette'

const HOME_GIG_LIMIT = 30
/** Module scope so the realtime hook is not handed a new query every render. */
const HOME_GIG_QUERY: GigListQuery = { limit: HOME_GIG_LIMIT }

/** This column stores what it renders, so the projection is identity. */
const keepSummary = (gig: GigSummary): GigSummary => gig

/**
 * ONE address per row. The column hands it to `ListColumn` twice — as `hrefOf`,
 * which the keyboard cursor pushes on Enter, and as the row's own `href` — and
 * those two must never disagree about where a row goes.
 */
const gigHref = (gig: GigSummary): string => `/home/gigs/${gig.escrow_id}`

/**
 * `total` rides EVERY phase, null only until the first answer. It used to live
 * on `ready` alone, so a failed background revalidation — which keeps the rows
 * — dropped the count from under them. The siblings key their count on
 * "has this ever fetched", never on the outcome of the latest attempt.
 */
type State = {
  phase: 'loading' | 'ready' | 'error'
  gigs: GigSummary[]
  total: number | null
}

export function OpenGigsListColumn() {
  const pathname = usePathname()
  const [state, setState] = useState<State>({ phase: 'loading', gigs: [], total: null })
  const { openPalette } = useCommandPalette()

  /**
   * ONE fetch path for the mount, the retry and the realtime reconcile — the
   * mount used to carry a second, near-identical copy of this. The generation
   * guard is what that copy's `cancelled` flag was for, and it does more: a
   * reconcile arriving while a retry is in flight can no longer land out of
   * order.
   */
  const generation = useRef(0)
  const fetchPage = useCallback(() => {
    const mine = ++generation.current
    void api.gigs.list(HOME_GIG_QUERY).then(
      (page) => {
        if (mine === generation.current) setState({ phase: 'ready', gigs: page.data, total: page.total })
      },
      () => {
        if (mine === generation.current) setState((current) => ({ ...current, phase: 'error' }))
      },
    )
  }, [])

  /** The reader ASKED, so say something is happening. A reconcile does not. */
  const retry = useCallback(() => {
    setState((current) => ({ ...current, phase: 'loading' }))
    fetchPage()
  }, [fetchPage])

  // The initial state is already `loading`, so the mount needs the fetch only.
  useEffect(() => { fetchPage() }, [fetchPage])

  /**
   * A frame the client was entitled to decide. The total moves by the
   * membership delta rather than being refetched — the row count is already
   * known and a round trip to learn "one more" is a round trip wasted. Floored
   * at zero: a removal for a row this page never held would otherwise print a
   * negative count.
   */
  const applyItems = useCallback((gigs: GigSummary[], membershipDelta: number) => {
    setState((current) => ({
      ...current,
      gigs,
      // Only once a total exists to move. Floored at zero: a page whose rows
      // outnumber a total computed under concurrent writes would otherwise
      // print a negative count.
      total: current.total === null ? null : Math.max(0, current.total + membershipDelta),
    }))
  }, [])

  useGigFeedRealtime<GigSummary>({
    items: state.gigs,
    query: HOME_GIG_QUERY,
    project: keepSummary,
    applyItems,
    // Client-fetched, so there is no second copy to refresh: reconciling means
    // asking for the list again, and only when the client could not decide.
    // Silently — a reader who has rows should not watch them blink because a
    // gig they cannot see changed.
    onReconcile: fetchPage,
  })

  const selected = pathname.match(/^\/home\/gigs\/([^/]+)$/)?.[1]
  const groups: readonly ListGroup<GigSummary>[] = [{ key: 'open', rows: state.gigs }]
  return (
    <ListColumn
      copy={{ title: 'Open gigs', emptyTitle: 'No open gigs', emptyBody: 'New work will appear here as soon as it is posted.' }}
      groups={groups}
      keyOf={(gig) => gig.escrow_id}
      hrefOf={gigHref}
      selectedKey={selected}
      isLoading={state.phase === 'loading' && state.gigs.length === 0}
      // Only when there is nothing left to show. `ListColumn` renders rows
      // ONLY while `error === null`, so surfacing a failed BACKGROUND
      // revalidation here would take a good list away from the reader — and
      // the offline fallback refetches precisely when those refetches fail.
      // Same rule the notifications and my-gigs columns state.
      error={state.phase === 'error' && state.gigs.length === 0 ? 'Could not load open gigs' : null}
      onRetry={retry}
      onOpenPalette={openPalette}
      // Whether a total is KNOWN, not whether the last attempt succeeded.
      countLabel={state.total !== null ? `${state.total} open` : undefined}
      // The browse row is the mini-card (2026-08-24 redesign): place + chain
      // on the second line, then who posted it, their rating, and the same
      // Apply|Accept fact the feed card shows — all off GigSummary, nothing
      // invented.
      renderRow={(gig, { active }) => (
        <EscrowRow
          href={gigHref(gig)}
          title={gig.title}
          status={gig.status}
          category={gig.category}
          amountRaw={gig.amount_raw}
          asset={gig.asset}
          subtitle={gigRowSubtitle(gig)}
          at={gig.created_at}
          creator={gig.creator}
          requiresApproval={gig.requires_approval}
          selected={active}
        />
      )}
    />
  )
}
