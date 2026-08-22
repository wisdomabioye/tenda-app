'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { GigSummary } from '@tenda/shared'
import { api } from '@/api/client'
import { ListColumn, type ListGroup } from '@/components/app/workspace/list'
import { EscrowRow } from '@/components/app/workspace/rows'
import { useCommandPalette } from '@/hooks/workspace/useCommandPalette'

const HOME_GIG_LIMIT = 30

type State = { phase: 'loading'; gigs: GigSummary[] } | { phase: 'ready'; gigs: GigSummary[]; total: number } | { phase: 'error'; gigs: GigSummary[] }

export function OpenGigsListColumn() {
  const pathname = usePathname()
  const [state, setState] = useState<State>({ phase: 'loading', gigs: [] })
  const { openPalette } = useCommandPalette()
  const load = useCallback(() => {
    setState((current) => ({ phase: 'loading', gigs: current.gigs }))
    void api.gigs.list({ limit: HOME_GIG_LIMIT }).then(
      (page) => setState({ phase: 'ready', gigs: page.data, total: page.total }),
      () => setState((current) => ({ phase: 'error', gigs: current.gigs })),
    )
  }, [])
  useEffect(() => {
    let cancelled = false
    void api.gigs.list({ limit: HOME_GIG_LIMIT }).then(
      (page) => { if (!cancelled) setState({ phase: 'ready', gigs: page.data, total: page.total }) },
      () => { if (!cancelled) setState({ phase: 'error', gigs: [] }) },
    )
    return () => { cancelled = true }
  }, [])

  const selected = pathname.match(/^\/home\/gigs\/([^/]+)$/)?.[1]
  const groups: readonly ListGroup<GigSummary>[] = [{ key: 'open', rows: state.gigs }]
  return (
    <ListColumn
      copy={{ title: 'Open gigs', emptyTitle: 'No open gigs', emptyBody: 'New work will appear here as soon as it is posted.' }}
      groups={groups}
      keyOf={(gig) => gig.escrow_id}
      hrefOf={(gig) => `/home/gigs/${gig.escrow_id}`}
      selectedKey={selected}
      isLoading={state.phase === 'loading' && state.gigs.length === 0}
      error={state.phase === 'error' ? 'Could not load open gigs' : null}
      onRetry={load}
      onOpenPalette={openPalette}
      countLabel={state.phase === 'ready' ? `${state.total} open` : undefined}
      renderRow={(gig, { active }) => <EscrowRow href={`/home/gigs/${gig.escrow_id}`} title={gig.title} status={gig.status} category={gig.category} amountRaw={gig.amount_raw} asset={gig.asset} at={gig.created_at} selected={active} />}
    />
  )
}
