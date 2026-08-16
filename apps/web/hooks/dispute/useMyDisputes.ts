/**
 * Web port of apps/mobile/hooks/useMyDisputes.ts: the caller's disputes
 * for one status bucket (open|resolved), paginated — the shared
 * controller's generation guard keeps a fast Open↔Resolved toggle safe.
 *
 * Mobile's focus-refresh has no web analogue ON PURPOSE: opening a thread
 * on web NAVIGATES (the list page unmounts), and returning remounts it
 * with a fresh page-0 load — the stale-bucket problem cannot occur.
 */
import type { MyDisputeRow, MyDisputeStatus, MyDisputesQuery } from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/pagination/usePaginatedList'

export type MyDisputesState = PaginatedListState<MyDisputeRow>

const keyOf = (row: MyDisputeRow) => row.dispute_id

export function useMyDisputes(status: MyDisputeStatus): MyDisputesState {
  return usePaginatedList<MyDisputeRow, MyDisputesQuery>({
    fetchPage: (params) => api.disputes.mine(params),
    query: { status },
    keyOf,
  })
}
