/**
 * useExchangeScreen — the Trade screen's two independent lists. Pins that the
 * chain filter reaches both, that the currency filter stays scoped to the
 * order book, and that "My Trades" never fires without a user id.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'

const mockExchangeList = jest.fn()
const mockUserEscrows = jest.fn()
jest.mock('@/api/client', () => ({
  api: {
    exchange: { list: (...a: unknown[]) => mockExchangeList(...a) },
    users: { escrows: (...a: unknown[]) => mockUserEscrows(...a) },
  },
}))

const mockUser = jest.fn()
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockUser() }),
}))

import { useExchangeScreen } from '@/hooks/useExchangeScreen'

const offerPage = { data: [{ escrow_id: 'o1' }], total: 1, limit: 20, offset: 0 }
const escrowPage = { data: [{ id: 'e1' }], total: 1, limit: 20, offset: 0 }

beforeEach(() => {
  mockExchangeList.mockReset().mockResolvedValue(offerPage)
  mockUserEscrows.mockReset().mockResolvedValue(escrowPage)
  mockUser.mockReturnValue({ id: 'user-1' })
})

test('loads the order book and my trades independently on mount', async () => {
  renderHook(() => useExchangeScreen())
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(1))
  expect(mockUserEscrows).toHaveBeenCalledTimes(1)
  // My Trades is scoped to exchange escrows, both sides (no role filter).
  expect(mockUserEscrows).toHaveBeenCalledWith(
    { id: 'user-1' },
    expect.objectContaining({ kind: 'exchange' }),
  )
})

test('the chain filter reaches BOTH lists', async () => {
  const { result } = renderHook(() => useExchangeScreen())
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(1))

  act(() => result.current.setChainId('eip155:84532'))
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(2))
  expect(mockExchangeList).toHaveBeenLastCalledWith(
    expect.objectContaining({ chain_id: 'eip155:84532', offset: 0 }),
  )
  await waitFor(() =>
    expect(mockUserEscrows).toHaveBeenLastCalledWith(
      { id: 'user-1' },
      expect.objectContaining({ chain_id: 'eip155:84532' }),
    ),
  )
})

test('the currency filter applies to the order book only', async () => {
  const { result } = renderHook(() => useExchangeScreen())
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(1))
  const tradesCallsBefore = mockUserEscrows.mock.calls.length

  act(() => result.current.setCurrency('NGN'))
  await waitFor(() =>
    expect(mockExchangeList).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'NGN' })),
  )
  // A fiat currency has no meaning for the escrow list — it must not refetch.
  expect(mockUserEscrows).toHaveBeenCalledTimes(tradesCallsBefore)
})

test('clearFilters drops both filters', async () => {
  const { result } = renderHook(() => useExchangeScreen())
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(1))

  act(() => result.current.setCurrency('NGN'))
  act(() => result.current.setChainId('solana:devnet'))
  await waitFor(() =>
    expect(mockExchangeList).toHaveBeenLastCalledWith(
      expect.objectContaining({ currency: 'NGN', chain_id: 'solana:devnet' }),
    ),
  )

  act(() => result.current.clearFilters())
  await waitFor(() =>
    expect(mockExchangeList).toHaveBeenLastCalledWith(
      expect.objectContaining({ currency: undefined, chain_id: undefined }),
    ),
  )
  expect(result.current.currency).toBeNull()
  expect(result.current.chainId).toBeNull()
})

test('my trades never requests without a user id', async () => {
  mockUser.mockReturnValue(null)
  const { result } = renderHook(() => useExchangeScreen())
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(1))
  // Firing with an empty id would 403 on someone else's escrows.
  expect(mockUserEscrows).not.toHaveBeenCalled()
  expect(result.current.myTrades.hasFetched).toBe(false)
})

test('the order book still loads for a signed-out-ish state', async () => {
  mockUser.mockReturnValue(null)
  renderHook(() => useExchangeScreen())
  await waitFor(() => expect(mockExchangeList).toHaveBeenCalledTimes(1))
})

test('the order book paginates independently of my trades', async () => {
  mockExchangeList.mockReset()
  mockExchangeList.mockImplementation((q: { offset: number }) =>
    Promise.resolve(
      q.offset === 0
        ? { data: [{ escrow_id: 'o1' }], total: 2, limit: 20, offset: 0 }
        : { data: [{ escrow_id: 'o2' }], total: 2, limit: 20, offset: 1 },
    ),
  )
  const { result } = renderHook(() => useExchangeScreen())
  await waitFor(() => expect(result.current.market.items).toHaveLength(1))

  act(() => result.current.market.loadMore())
  await waitFor(() => expect(result.current.market.items).toHaveLength(2))
  expect(result.current.myTrades.items).toHaveLength(1)
})

test('my trades paginates independently of the order book', async () => {
  mockUserEscrows.mockReset()
  mockUserEscrows.mockImplementation((_p: unknown, q: { offset: number }) =>
    Promise.resolve(
      q.offset === 0
        ? { data: [{ id: 'e1' }], total: 2, limit: 20, offset: 0 }
        : { data: [{ id: 'e2' }], total: 2, limit: 20, offset: 1 },
    ),
  )
  const { result } = renderHook(() => useExchangeScreen())
  await waitFor(() => expect(result.current.myTrades.items).toHaveLength(1))

  act(() => result.current.myTrades.loadMore())
  await waitFor(() => expect(result.current.myTrades.items).toHaveLength(2))
  expect(result.current.myTrades.items.map((r) => r.id)).toEqual(['e1', 'e2'])
})
