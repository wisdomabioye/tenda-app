/**
 * useMyGigs — both tabs load on mount so neither count chip reads 0 until its
 * tab is opened (open_issues MB2), the chain filter applies to both, and both
 * re-read on a later focus so a tab that never unmounts can't serve stale rows.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'

const mockList = jest.fn()
jest.mock('@/api/client', () => ({ api: { gigs: { list: (...a: unknown[]) => mockList(...a) } } }))

const mockUser = jest.fn()
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockUser() }),
}))

// Focus fires on mount and again on demand — My Gigs is a tab, so the SECOND
// focus is the case that matters.
jest.mock('expo-router', () => {
  const React = require('react')
  const { registerFocus } = require('@/hooks/__fixtures__/focus')
  return { useFocusEffect: (cb: () => void) => React.useEffect(() => registerFocus(cb), [cb]) }
})

import { useMyGigs } from '@/hooks/useMyGigs'
import { refocus, resetFocus } from '@/hooks/__fixtures__/focus'

afterEach(() => resetFocus())

const pageFor = (mine: string) =>
  mine === 'created'
    ? { data: [{ escrow_id: 'p1' }], total: 12, limit: 20, offset: 0 }
    : { data: [{ escrow_id: 'w1' }], total: 3, limit: 20, offset: 0 }

beforeEach(() => {
  mockList.mockReset()
  mockUser.mockReturnValue({ id: 'user-1' })
  mockList.mockImplementation((q: { mine: string }) => Promise.resolve(pageFor(q.mine)))
})

test('loads BOTH tabs on mount — the inactive count must not read 0', async () => {
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(result.current.working.total).toBe(3))

  // Posted was never "the active tab" here, yet both totals are populated.
  expect(result.current.posted.total).toBe(12)
  expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ mine: 'created' }))
  expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ mine: 'working' }))
})

test('counts come from the server total, not the loaded row count', async () => {
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(result.current.posted.total).toBe(12))
  // One row loaded, twelve exist — a `.length` count would say 1.
  expect(result.current.posted.items).toHaveLength(1)
})

test('the chain filter applies to both tabs and resets each to page 0', async () => {
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))

  act(() => result.current.setChainId('eip155:84532'))
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(4))

  const filtered = mockList.mock.calls
    .slice(2)
    .map(([q]: [{ mine: string; chain_id?: string; offset: number }]) => q)
  expect(filtered.map((q) => q.mine).sort()).toEqual(['created', 'working'])
  expect(filtered.every((q) => q.chain_id === 'eip155:84532')).toBe(true)
  expect(filtered.every((q) => q.offset === 0)).toBe(true)
})

test('does not fetch before the signed-in user is known', async () => {
  mockUser.mockReturnValue(null)
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(result.current.posted.isLoading).toBe(false))
  expect(mockList).not.toHaveBeenCalled()
  expect(result.current.posted.hasFetched).toBe(false)
})

test('each tab paginates independently', async () => {
  mockList.mockReset()
  mockList.mockImplementation((q: { mine: string; offset: number }) =>
    Promise.resolve(
      q.offset === 0
        ? { data: [{ escrow_id: `${q.mine}-1` }], total: 2, limit: 20, offset: 0 }
        : { data: [{ escrow_id: `${q.mine}-2` }], total: 2, limit: 20, offset: 1 },
    ),
  )
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(result.current.posted.items).toHaveLength(1))

  act(() => result.current.posted.loadMore())
  await waitFor(() => expect(result.current.posted.items).toHaveLength(2))
  // Paging Posted must not disturb Working.
  expect(result.current.working.items).toHaveLength(1)
})

test('a later focus re-reads BOTH tabs, so rows and count chips cannot go stale', async () => {
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))

  // Post a gig, then come back to the tab: the screen never unmounted, so
  // without this the list and its `total` chip stayed on pre-post state.
  mockList.mockImplementation((q: { mine: string }) =>
    Promise.resolve(
      q.mine === 'created'
        ? { data: [{ escrow_id: 'p1' }, { escrow_id: 'p2' }], total: 13, limit: 20, offset: 0 }
        : pageFor('working'),
    ),
  )
  await act(async () => { refocus() })

  await waitFor(() => expect(result.current.posted.total).toBe(13))
  expect(mockList).toHaveBeenCalledTimes(4)
  const refetched = mockList.mock.calls.slice(2).map(([q]: [{ mine: string; offset: number }]) => q)
  expect(refetched.map((q) => q.mine).sort()).toEqual(['created', 'working'])
  expect(refetched.every((q) => q.offset === 0)).toBe(true)
})

test('the focus re-read is silent — no skeleton over a list already on screen', async () => {
  const { result } = renderHook(() => useMyGigs())
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))

  mockList.mockImplementation(() => new Promise(() => {})) // in flight, never settles
  await act(async () => { refocus() })
  // `reload`, not `refresh`/`initial`: rows and flags stay put while it runs.
  expect(result.current.posted.isLoading).toBe(false)
  expect(result.current.posted.isRefreshing).toBe(false)
  expect(result.current.posted.items).toHaveLength(1)
})

test('the FIRST focus does not double-fetch either tab', async () => {
  // Page 0 is owned by each controller's query effect. A focus effect that
  // fetched unconditionally would make every cold open 4 requests, not 2 —
  // the exact double-fetch this screen was cleaned of.
  renderHook(() => useMyGigs())
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))

  await new Promise((r) => setTimeout(r, 20))
  expect(mockList).toHaveBeenCalledTimes(2)
})

test('a focus before sign-in settles does not fetch', async () => {
  mockUser.mockReturnValue(null)
  renderHook(() => useMyGigs())
  await act(async () => { refocus() })
  // Nothing has been fetched, so there is nothing to re-read — and `mine=`
  // would 401 before the JWT is in place.
  expect(mockList).not.toHaveBeenCalled()
})

test('totals stay 0-but-unfetched until the first response, so chips can hide', async () => {
  // The screen renders a count chip only when `hasFetched` — a `total` of 0
  // during load would read as a confident "you have none".
  const { result } = renderHook(() => useMyGigs())
  expect(result.current.posted.hasFetched).toBe(false)
  expect(result.current.working.hasFetched).toBe(false)

  await waitFor(() => expect(result.current.posted.hasFetched).toBe(true))
  await waitFor(() => expect(result.current.working.hasFetched).toBe(true))
  expect(result.current.posted.total).toBe(12)
})
