/**
 * The one list renderer's contract: spinner only before the first page,
 * error surface with retry only when there is nothing to show, empty
 * node, rows + Load more only while hasMore.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PaginatedList } from '@/components/shared/PaginatedList'
import type { PaginatedListState } from '@/hooks/pagination/usePaginatedList'

function listState(over: Partial<PaginatedListState<string>>): PaginatedListState<string> {
  return {
    items: [],
    total: 0,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
    hasFetched: true,
    error: null,
    loadMore: vi.fn(),
    refresh: vi.fn(async () => {}),
    reload: vi.fn(async () => 0),
    reconcile: vi.fn(async () => true),
    applyRealtimeItems: vi.fn(),
    ...over,
  }
}

const renderRow = (item: string) => <span>{item}</span>

test('spinner before the first page; empty node once fetched empty', () => {
  const { rerender } = render(
    <PaginatedList list={listState({ hasFetched: false })} keyOf={(s) => s} renderItem={renderRow} empty={<p>none</p>} />,
  )
  expect(screen.queryByText('none')).toBeNull() // still loading

  rerender(
    <PaginatedList list={listState({})} keyOf={(s) => s} renderItem={renderRow} empty={<p>none</p>} />,
  )
  expect(screen.getByText('none')).toBeInTheDocument()
})

test('error replaces the list ONLY when there is nothing to show, and retry refreshes', async () => {
  const refresh = vi.fn(async () => {})
  render(
    <PaginatedList
      list={listState({ error: 'boom', refresh })}
      keyOf={(s) => s}
      renderItem={renderRow}
      empty={<p>none</p>}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(refresh).toHaveBeenCalled()

  render(
    <PaginatedList
      list={listState({ error: 'boom', items: ['row-1'] })}
      keyOf={(s) => s}
      renderItem={renderRow}
      empty={<p>none</p>}
    />,
  )
  expect(screen.getByText('row-1')).toBeInTheDocument() // rows win over the error surface
})

test('rows render with Load more only while hasMore', async () => {
  const loadMore = vi.fn()
  const { rerender } = render(
    <PaginatedList
      list={listState({ items: ['a', 'b'], hasMore: true, loadMore })}
      keyOf={(s) => s}
      renderItem={renderRow}
      empty={<p>none</p>}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
  expect(loadMore).toHaveBeenCalled()

  rerender(
    <PaginatedList
      list={listState({ items: ['a', 'b'], hasMore: false })}
      keyOf={(s) => s}
      renderItem={renderRow}
      empty={<p>none</p>}
    />,
  )
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
})
