'use client'

/**
 * The one list renderer over usePaginatedList state — web analogue of
 * mobile's ui/PaginatedList, shared by disputes / my-gigs / exchange.
 * Convention carried over: a populated list is NEVER swapped for a
 * skeleton — the spinner shows only before the first page lands, and
 * errors replace the list only when there is nothing to show.
 */
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { PaginatedListState } from '@/hooks/pagination/usePaginatedList'

export function PaginatedList<TItem>({
  list,
  keyOf,
  renderItem,
  empty,
  errorTitle = 'Could not load the list',
}: {
  list: PaginatedListState<TItem>
  keyOf: (item: TItem) => string
  renderItem: (item: TItem) => ReactNode
  empty: ReactNode
  errorTitle?: string
}) {
  if (!list.hasFetched && list.error === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (list.error !== null && list.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
        <p className="font-semibold text-content-primary">{list.error || errorTitle}</p>
        <Button variant="outline" onClick={() => void list.refresh()}>
          Try again
        </Button>
      </div>
    )
  }

  if (list.items.length === 0) return <>{empty}</>

  return (
    <div className="flex flex-col gap-2">
      {list.items.map((item) => (
        <div key={keyOf(item)}>{renderItem(item)}</div>
      ))}
      {list.hasMore && (
        <div className="flex justify-center py-3">
          <Button variant="outline" disabled={list.isLoadingMore} onClick={() => list.loadMore()}>
            {list.isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
