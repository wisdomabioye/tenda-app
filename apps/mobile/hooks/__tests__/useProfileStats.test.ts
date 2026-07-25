/**
 * useProfileStats — profile counts as server COUNTs (open_issues MB2).
 * The point of the hook is that a status-bucketed count is NOT derivable from
 * a page of rows, so these tests pin the request shape as much as the output.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'

const mockList = jest.fn()
jest.mock('@/api/client', () => ({ api: { gigs: { list: (...a: unknown[]) => mockList(...a) } } }))

// useFocusEffect ≡ useEffect for a mounted screen.
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) }
})

import { useProfileStats } from '@/hooks/useProfileStats'

/** Answer each of the three count queries by its filter shape. */
function respondWith({ posted, active, completed }: { posted: number; active: number; completed: number }) {
  mockList.mockImplementation((q: { mine: string; status?: string[] }) => {
    if (q.mine === 'working') return Promise.resolve({ data: [], total: completed, limit: 1, offset: 0 })
    if (q.status !== undefined) return Promise.resolve({ data: [], total: active, limit: 1, offset: 0 })
    return Promise.resolve({ data: [], total: posted, limit: 1, offset: 0 })
  })
}

beforeEach(() => mockList.mockReset())

test('reads each count off `total`, asking for the smallest legal page', async () => {
  respondWith({ posted: 137, active: 4, completed: 22 })
  const { result } = renderHook(() => useProfileStats('u1'))

  await waitFor(() => expect(result.current.loaded).toBe(true))
  // 137 posted is past the old limit:100 page — the count that page could
  // never have produced is exactly the regression this guards.
  expect(result.current.posted).toBe(137)
  expect(result.current.active).toBe(4)
  expect(result.current.completed).toBe(22)

  for (const [query] of mockList.mock.calls) {
    expect(query.limit).toBe(1)
  }
})

test('asks the server for the status buckets rather than filtering client-side', async () => {
  respondWith({ posted: 1, active: 1, completed: 1 })
  renderHook(() => useProfileStats('u1'))
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(3))

  expect(mockList).toHaveBeenCalledWith({ mine: 'created', status: undefined, limit: 1 })
  expect(mockList).toHaveBeenCalledWith({
    mine: 'created',
    status: ['open', 'accepted', 'submitted'],
    limit: 1,
  })
  expect(mockList).toHaveBeenCalledWith({ mine: 'working', status: ['completed'], limit: 1 })
})

test('does not query before the user id is known', async () => {
  respondWith({ posted: 1, active: 1, completed: 1 })
  const { result } = renderHook(() => useProfileStats(undefined))
  await waitFor(() => expect(result.current.loaded).toBe(false))
  expect(mockList).not.toHaveBeenCalled()
})

test('starts from zero on an account switch instead of showing the previous counts', async () => {
  respondWith({ posted: 9, active: 9, completed: 9 })
  const { result, rerender } = renderHook(({ id }: { id: string }) => useProfileStats(id), {
    initialProps: { id: 'u1' },
  })
  await waitFor(() => expect(result.current.posted).toBe(9))

  mockList.mockImplementation(() => new Promise(() => {})) // next account, still loading
  rerender({ id: 'u2' })
  expect(result.current.posted).toBe(0)
  expect(result.current.loaded).toBe(false)
})

test('a superseded response never overwrites the current account counts', async () => {
  let resolveFirst: ((v: unknown) => void) | undefined
  mockList.mockImplementationOnce(() => new Promise((res) => { resolveFirst = res }))
  mockList.mockImplementation(() => Promise.resolve({ data: [], total: 5, limit: 1, offset: 0 }))

  const { result, rerender } = renderHook(({ id }: { id: string }) => useProfileStats(id), {
    initialProps: { id: 'u1' },
  })
  rerender({ id: 'u2' })
  await waitFor(() => expect(result.current.posted).toBe(5))

  await act(async () => { resolveFirst?.({ data: [], total: 999, limit: 1, offset: 0 }) })
  expect(result.current.posted).toBe(5)
})

test('a failed count settles rather than hanging the profile', async () => {
  mockList.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => useProfileStats('u1'))
  await waitFor(() => expect(result.current.loaded).toBe(true))
  // Counts stay at their last value; a stat is not worth an error screen.
  expect(result.current.posted).toBe(0)
})

test('reload refetches every count', async () => {
  respondWith({ posted: 1, active: 1, completed: 1 })
  const { result } = renderHook(() => useProfileStats('u1'))
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(3))

  respondWith({ posted: 2, active: 2, completed: 2 })
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.posted).toBe(2))
})

test('a superseded FAILED request does not settle the new account loading state', async () => {
  // The old account's request rejects after the switch. Marking `loaded` from
  // that stale failure would let the new account render zeroes as fact while
  // its own counts are still in flight.
  let rejectFirst: ((e: Error) => void) | undefined
  mockList.mockImplementationOnce(() => new Promise((_res, rej) => { rejectFirst = rej }))
  mockList.mockImplementation(() => new Promise(() => {})) // new account: still loading

  const { result, rerender } = renderHook(({ id }: { id: string }) => useProfileStats(id), {
    initialProps: { id: 'u1' },
  })
  rerender({ id: 'u2' })

  await act(async () => { rejectFirst?.(new Error('stale')) })
  expect(result.current.loaded).toBe(false)
})

test('loads exactly ONE round of counts on mount, not two', async () => {
  // The hook owns its focus refetch. When the screen also called reload() on
  // focus, mount fired 3 + 3 = 6 requests — the same double-fetch pattern that
  // was fixed on My Gigs and Trade.
  respondWith({ posted: 1, active: 1, completed: 1 })
  renderHook(() => useProfileStats('u1'))
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(3))

  await new Promise((r) => setTimeout(r, 20))
  expect(mockList).toHaveBeenCalledTimes(3)
})
