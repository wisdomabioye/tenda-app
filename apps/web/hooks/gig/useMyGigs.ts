/**
 * Web port of apps/mobile/hooks/useMyGigs.ts: the caller's Posted,
 * Working, Drafts and Applications lists, each independently paginated.
 *
 * Drafts are their OWN list (never rows mixed into Posted): "Posted" is
 * POSTED_ESCROW_STATUSES exactly, so its count chip can never be inflated
 * by pre-signature staging rows. Drafts feed a banner above Posted that
 * links to /my-gigs/drafts. ALL lists load on mount so inactive tabs'
 * count chips read a real server `total`, never a zero for an unfetched
 * list. Mobile's focus refresh has no web analogue (pages remount on
 * navigation). Applications are deliberately NOT chain-filtered:
 * /v1/applications is caller-scoped with no chain parameter.
 */
import { useState } from 'react'
import {
  POSTED_ESCROW_STATUSES,
  type EscrowStatus,
  type GigListQuery,
  type GigSummary,
  type MyApplication,
} from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/pagination/usePaginatedList'
import { useDraftGigs } from '@/hooks/gig/useDraftGigs'
import { useAuthStore } from '@/stores/auth.store'

export interface MyGigsState {
  /** Gigs the caller posted on-chain — every status except `draft`. */
  posted: PaginatedListState<GigSummary>
  working: PaginatedListState<GigSummary>
  /** Unfunded staging rows — consumed here for the banner's `total`. */
  drafts: PaginatedListState<GigSummary>
  applications: PaginatedListState<MyApplication>
  chainId: string | null
  setChainId: (chain_id: string | null) => void
}

const keyOf = (gig: GigSummary) => gig.escrow_id
// The APPLICATION id, not the gig's: keying on the gig would collide the
// moment the same list carries a withdrawn row and its re-application.
const applicationKeyOf = (row: MyApplication) => row.application.id

const EMPTY_QUERY: Record<string, never> = {}
const POSTED_STATUSES: EscrowStatus[] = [...POSTED_ESCROW_STATUSES]

export function useMyGigs(): MyGigsState {
  const user = useAuthStore((s) => s.user)
  const [chainId, setChainId] = useState<string | null>(null)

  const enabled = user?.id !== undefined

  const posted = usePaginatedList<GigSummary, GigListQuery>({
    fetchPage: (params) => api.gigs.list(params),
    query: { mine: 'created', status: POSTED_STATUSES, chain_id: chainId ?? undefined },
    keyOf,
    enabled,
  })

  const working = usePaginatedList<GigSummary, GigListQuery>({
    fetchPage: (params) => api.gigs.list(params),
    query: { mine: 'working', chain_id: chainId ?? undefined },
    keyOf,
    enabled,
  })

  // NOT chain-filtered: the banner's only job is "you have unfunded work
  // sitting here" — a chain-scoped count would make it vanish under a chip.
  const drafts = useDraftGigs()

  const applications = usePaginatedList<MyApplication, Record<string, never>>({
    fetchPage: (params) => api.applications.mine(params),
    query: EMPTY_QUERY,
    keyOf: applicationKeyOf,
    enabled,
  })

  return { posted, working, drafts, applications, chainId, setChainId }
}
