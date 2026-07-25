/**
 * Loads the caller's disputes for one status bucket (open|resolved), paginated.
 * Refetches whenever `status` changes, so a segmented toggle just swaps the
 * argument — the shared controller's generation guard is what keeps a fast
 * Open↔Resolved toggle (or a reload racing a toggle) safe: a superseded batch
 * can never overwrite the latest. That guard used to be hand-rolled here.
 *
 * No chain filter, deliberately: `MyDisputeRow` carries no `chain_id`, and a
 * dispute is about a counterparty rather than a settlement network — a chain
 * chip here would filter on data the row never shows.
 */
import type { MyDisputeRow, MyDisputeStatus, MyDisputesQuery } from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/usePaginatedList'

export type MyDisputesState = PaginatedListState<MyDisputeRow>

const keyOf = (row: MyDisputeRow) => row.dispute_id

export function useMyDisputes(status: MyDisputeStatus): MyDisputesState {
  return usePaginatedList<MyDisputeRow, MyDisputesQuery>({
    fetchPage: (params) => api.disputes.mine(params),
    query: { status },
    keyOf,
  })
}
