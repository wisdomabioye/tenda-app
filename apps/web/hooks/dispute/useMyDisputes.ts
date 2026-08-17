/**
 * Web port of apps/mobile/hooks/useMyDisputes.ts: the caller's disputes
 * for one status bucket (open|resolved), paginated — the shared
 * controller's generation guard keeps a fast Open↔Resolved toggle safe.
 *
 * Mobile's focus-refresh has no web analogue ON PURPOSE: every mount reloads
 * page zero, so the stale-bucket problem cannot occur. Since #16 the list is a
 * workspace column that the router remounts on every row it opens, so that
 * reload is now SILENT — see `PAGE_ZERO` below.
 */
import { createQueryCache, type MyDisputeRow, type MyDisputeStatus, type MyDisputesQuery } from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/pagination/usePaginatedList'

export type MyDisputesState = PaginatedListState<MyDisputeRow>

const keyOf = (row: MyDisputeRow) => row.dispute_id

/**
 * Module-scoped so page zero of each bucket outlives the hook.
 *
 * The disputes list is a workspace COLUMN now, and Next remounts the @list
 * slot whenever the route moves between /disputes and /dispute/<id> — i.e. on
 * every row the reader opens. A per-instance cache cannot help there, and the
 * column blinked through a skeleton each time. Page zero only, keyed by the
 * bucket, and silently revalidated on every mount, so what it can serve is at
 * most one navigation stale — and only for the moment before the refetch lands.
 */
const PAGE_ZERO = createQueryCache<MyDisputeRow>()

export function useMyDisputes(status: MyDisputeStatus): MyDisputesState {
  return usePaginatedList<MyDisputeRow, MyDisputesQuery>({
    fetchPage: (params) => api.disputes.mine(params),
    query: { status },
    keyOf,
    cache: PAGE_ZERO,
  })
}
