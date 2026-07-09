/**
 * useMyDisputes — loads the caller's disputes for one status bucket, surfaces
 * errors, and refetches when the segment (status) changes.
 */
import { renderHook, waitFor } from '@testing-library/react-native'
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
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.rows).toHaveLength(1)
  expect(result.current.error).toBeNull()
  expect(mockMine).toHaveBeenCalledWith({ status: 'open' })
})

test('surfaces an error message and leaves rows empty', async () => {
  mockMine.mockRejectedValue(new Error('network down'))
  const { result } = renderHook(() => useMyDisputes('open'))
  await waitFor(() => expect(result.current.error).toBe('network down'))
  expect(result.current.rows).toEqual([])
  expect(result.current.loading).toBe(false)
})

test('refetches when the status segment changes', async () => {
  mockMine.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 })
  const { result, rerender } = renderHook(({ s }: { s: 'open' | 'resolved' }) => useMyDisputes(s), {
    initialProps: { s: 'open' },
  })
  await waitFor(() => expect(result.current.loading).toBe(false))
  rerender({ s: 'resolved' })
  await waitFor(() => expect(mockMine).toHaveBeenLastCalledWith({ status: 'resolved' }))
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
  await waitFor(() => expect(result.current.rows).toHaveLength(1))
  expect(result.current.rows[0].dispute_id).toBe('resolved-1')

  // The stale 'open' batch now lands — it must be ignored.
  resolveOpen({ data: [row('open-STALE')], total: 1, limit: 20, offset: 0 })
  await new Promise((r) => setTimeout(r, 0))
  expect(result.current.rows[0].dispute_id).toBe('resolved-1')
})
