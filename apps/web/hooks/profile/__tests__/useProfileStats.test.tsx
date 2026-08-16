/**
 * Profile counts as server COUNTs: each stat is `limit: 1` with the
 * answer read off `total`, "Posted" excludes drafts by query, and the
 * generation guard drops superseded responses on an account switch.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { POSTED_ESCROW_STATUSES, type GigListQuery } from '@tenda/shared'

const gigsApi = vi.hoisted(() => ({
  list: vi.fn<(q?: GigListQuery) => Promise<{ data: never[]; total: number; limit: number; offset: number }>>(),
}))
vi.mock('@/api/client', () => ({ api: { gigs: gigsApi } }))

import { useProfileStats } from '@/hooks/profile/useProfileStats'

beforeEach(() => {
  vi.clearAllMocks()
})

test('reads three limit-1 counts; posted excludes drafts by construction', async () => {
  gigsApi.list.mockImplementation(async (q) => ({
    data: [],
    total: q?.mine === 'working' ? 4 : Array.isArray(q?.status) && q.status.length > 3 ? 9 : 2,
    limit: 1,
    offset: 0,
  }))
  const { result } = renderHook(() => useProfileStats('me'))
  await waitFor(() => expect(result.current.loaded).toBe(true))

  expect(result.current.posted).toBe(9)
  expect(result.current.active).toBe(2)
  expect(result.current.completed).toBe(4)

  for (const [q] of gigsApi.list.mock.calls) {
    expect(q?.limit).toBe(1)
  }
  const postedQuery = gigsApi.list.mock.calls.map(([q]) => q).find((q) => Array.isArray(q?.status) && q.status.length > 3)
  expect(postedQuery?.status).toEqual([...POSTED_ESCROW_STATUSES])
  expect(postedQuery?.status).not.toContain('draft')
})

test('no user id → no requests; count failures leave the profile renderable', async () => {
  renderHook(() => useProfileStats(undefined))
  await Promise.resolve()
  expect(gigsApi.list).not.toHaveBeenCalled()

  gigsApi.list.mockRejectedValue(new Error('down'))
  const { result } = renderHook(() => useProfileStats('me'))
  await waitFor(() => expect(result.current.loaded).toBe(true))
  expect(result.current.posted).toBe(0) // kept, not an error screen
})
