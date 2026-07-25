/**
 * useMyDisputes — loads the caller's disputes for one status bucket, surfaces
 * errors, and refetches when the segment (status) changes.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { MyDisputeRow } from '@tenda/shared'

const mockMine = jest.fn()
jest.mock('@/api/client', () => ({ api: { disputes: { mine: (...a: unknown[]) => mockMine(...a) } } }))

import { useMyDisputes } from '@/hooks/useMyDisputes'

function row(id: string): MyDisputeRow {
  return {
    dispute_id: id,
    escrow_id: `e-${id}`,
    kind: 'gig',
    subject_title: 'Paint the fence',
    status: 'disputed',
    my_role: 'creator',
    counterparty_name: 'Ben Worker',
    reason: 'never showed up',
    raised_at: '2026-07-01T00:00:00.000Z',
    winner: null,
    resolved_at: null,
    raised_by_me: true,
  }
}

beforeEach(() => mockMine.mockReset())

test('loads open disputes on mount', async () => {
  mockMine.mockResolvedValue({ data: [row('d1')], total: 1, limit: 20, offset: 0 })
  const { result } = renderHook(() => useMyDisputes('open'))
  expect(result.current.isLoading).toBe(true)
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.items).toHaveLength(1)
  expect(result.current.error).toBeNull()
  expect(mockMine).toHaveBeenCalledWith({ status: 'open', limit: 20, offset: 0 })
})

test('surfaces an error message and leaves the list empty', async () => {
  mockMine.mockRejectedValue(new Error('network down'))
  const { result } = renderHook(() => useMyDisputes('open'))
  await waitFor(() => expect(result.current.error).toBe('network down'))
  expect(result.current.items).toEqual([])
  expect(result.current.isLoading).toBe(false)
})

test('refetches when the status segment changes', async () => {
  mockMine.mockResolvedValue({ data: [row('d9')], total: 1, limit: 20, offset: 0 })
  const { result, rerender } = renderHook(({ s }: { s: 'open' | 'resolved' }) => useMyDisputes(s), {
    initialProps: { s: 'open' },
  })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  rerender({ s: 'resolved' })
  await waitFor(() => expect(mockMine).toHaveBeenLastCalledWith({ status: 'resolved', limit: 20, offset: 0 }))
})

test('a slow stale response never overwrites the latest segment', async () => {
  // First (open) request resolves LATE; second (resolved) resolves first.
  let resolveOpen: (v: unknown) => void = () => {}
  const openPending = new Promise((res) => {
    resolveOpen = res
  })
  mockMine.mockImplementationOnce(() => openPending) // open
  mockMine.mockResolvedValueOnce({ data: [row('resolved-1')], total: 1, limit: 20, offset: 0 }) // resolved

  const { result, rerender } = renderHook(({ s }: { s: 'open' | 'resolved' }) => useMyDisputes(s), {
    initialProps: { s: 'open' },
  })
  rerender({ s: 'resolved' })
  await waitFor(() => expect(result.current.items).toHaveLength(1))
  expect(result.current.items[0].dispute_id).toBe('resolved-1')

  // The stale 'open' batch now lands — it must be ignored.
  resolveOpen({ data: [row('open-STALE')], total: 1, limit: 20, offset: 0 })
  await new Promise((r) => setTimeout(r, 0))
  expect(result.current.items[0].dispute_id).toBe('resolved-1')
})

test('paginates, de-duplicating a shifted window', async () => {
  mockMine
    .mockResolvedValueOnce({ data: [row('d1'), row('d2')], total: 3, limit: 20, offset: 0 })
    .mockResolvedValueOnce({ data: [row('d2'), row('d3')], total: 3, limit: 20, offset: 2 })
  const { result } = renderHook(() => useMyDisputes('open'))
  await waitFor(() => expect(result.current.items).toHaveLength(2))

  act(() => result.current.loadMore())
  await waitFor(() => expect(result.current.items).toHaveLength(3))
  expect(result.current.items.map((r) => r.dispute_id)).toEqual(['d1', 'd2', 'd3'])
})
