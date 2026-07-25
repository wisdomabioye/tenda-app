/**
 * useWalletScreen, multichain data controller. Asserts the no-wallet loading
 * fix (isLoading must SETTLE, not strand the skeleton, when no wallet is linked
 *, the old hook early-returned and looped forever) and the USDC-total wiring.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'

let mockUser: { id: string } | null = { id: 'u1' }
let mockWallets: Array<{ chain_ns: string; address: string }> = []
let mockWalletsStatus = 'ready'
const mockRetry = jest.fn()
let mockChains: unknown[] | null = []
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: mockUser, wallets: mockWallets, walletsStatus: mockWalletsStatus, retryWalletSync: mockRetry }),
}))
jest.mock('@/stores/chain-registry.store', () => ({
  useChainRegistryStore: (sel: (s: unknown) => unknown) => sel({ chains: mockChains }),
}))

const mockRead = jest.fn((_wallets?: unknown, _chains?: unknown) => Promise.resolve([] as unknown[]))
const mockSum = jest.fn((_balances?: unknown) => '0')
jest.mock('@/wallet/balances', () => ({
  readWalletBalances: (wallets: unknown, chains: unknown) => mockRead(wallets, chains),
  sumUsdcRaw: (balances: unknown) => mockSum(balances),
}))
/** One page of the transaction feed, as the wire delivers it. */
type TxPage = { data: unknown[]; total: number; limit: number; offset: number }
const mockTxns = jest.fn((_args?: unknown, _query?: unknown): Promise<TxPage> =>
  Promise.resolve({ data: [], total: 0, limit: 20, offset: 0 }))
const mockSummary = jest.fn((_args?: unknown) =>
  Promise.resolve({ earned_raw: '0', spent_raw: '0', asset: 'USDC_SOL' }))
jest.mock('@/api/client', () => ({
  api: {
    users: {
      transactions: (args: unknown, query: unknown) => mockTxns(args, query),
      transactionsSummary: (args: unknown) => mockSummary(args),
    },
  },
}))
// Focus fires once on mount and again on demand — a tab screen stays mounted,
// so "what happens on the SECOND focus" is real behaviour, not a corner case.
jest.mock('expo-router', () => {
  const React = require('react')
  const { registerFocus } = require('@/hooks/__fixtures__/focus')
  return { useFocusEffect: (cb: () => void) => React.useEffect(() => registerFocus(cb), [cb]) }
})

import { useWalletScreen } from '@/hooks/useWalletScreen'
import { refocus, resetFocus } from '@/hooks/__fixtures__/focus'

afterEach(() => resetFocus())

beforeEach(() => {
  mockUser = { id: 'u1' }
  mockWallets = []
  mockWalletsStatus = 'ready'
  mockRetry.mockReset()
  mockChains = []
  mockRead.mockReset().mockResolvedValue([])
  mockSum.mockReset().mockReturnValue('0')
  mockTxns.mockReset().mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 })
  mockSummary.mockReset().mockResolvedValue({ earned_raw: '0', spent_raw: '0', asset: 'USDC_SOL' })
})

test('no wallet linked → hasWallet false and isLoading SETTLES (no infinite skeleton)', async () => {
  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.hasWallet).toBe(false)
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  // It still attempts a read (with an empty wallet list) rather than early-returning.
  expect(mockRead).toHaveBeenCalledWith([], [])
})

test('with a wallet → reads balances and derives the USDC headline total', async () => {
  mockWallets = [{ chain_ns: 'solana', address: 'SoL' }]
  mockChains = [{ id: 'solana:devnet', namespace: 'solana', display_name: 'Solana', assets: [] }]
  mockRead.mockResolvedValue([
    { chainId: 'solana:devnet', namespace: 'solana', displayName: 'Solana', address: 'SoL',
      usdc: { assetId: 'USDC_SOL', symbol: 'USDC', amountRaw: '50000000', decimals: 6, isStable: true }, native: null },
  ])
  mockSum.mockReturnValue('50000000') // 50 USDC (6dp)

  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.hasWallet).toBe(true)
  await waitFor(() => expect(result.current.balances).toHaveLength(1))
  expect(result.current.totalUsdc).toBe(50)
})

test('surfaces walletsStatus and the retry handler so the screen can distinguish load states', async () => {
  mockWalletsStatus = 'error'
  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.walletsStatus).toBe('error')
  expect(result.current.retryWallets).toBe(mockRetry)
  await waitFor(() => expect(result.current.isLoading).toBe(false)) // settle the load effect
})

// ─── lifetime totals (open_issues MB1) ────────────────────────────────────────
// The earned/spent RULES (which tx types count, whose side, skipping unattested
// amounts, no double fee subtraction) are now a SQL aggregate and are pinned in
// apps/server/test/integration/transactions-summary.test.ts. What belongs here
// is that the hook reads that aggregate rather than reducing the feed.

test('lifetime totals come from the summary endpoint, not from the loaded page', async () => {
  // A page holding one small row, against a much larger lifetime total: if the
  // hook were still reducing the feed it could only ever report the page.
  mockTxns.mockResolvedValue({
    data: [{ id: 't1', created_at: '2026-07-17T10:00:00.000Z' }],
    total: 500,
    limit: 20,
    offset: 0,
  })
  mockSummary.mockResolvedValue({ earned_raw: '1980000', spent_raw: '2000000', asset: 'USDC_SOL' })

  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.earnedUsdc).toBeCloseTo(1.98, 6))
  expect(result.current.spentUsdc).toBeCloseTo(2, 6)
  expect(mockSummary).toHaveBeenCalledWith({ id: 'u1' })
})

test('converts raw base units using the asset the server names', async () => {
  mockSummary.mockResolvedValue({ earned_raw: '12345678', spent_raw: '0', asset: 'USDC_SOL' })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.earnedUsdc).toBeCloseTo(12.345678, 6))
})

test('a failed summary keeps the last totals rather than flashing zeroes', async () => {
  mockSummary.mockResolvedValue({ earned_raw: '5000000', spent_raw: '0', asset: 'USDC_SOL' })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.earnedUsdc).toBeCloseTo(5, 6))

  mockSummary.mockRejectedValue(new Error('offline'))
  await act(async () => { await result.current.handleRefresh() })
  // Zeroes here would read as "you have earned nothing".
  expect(result.current.earnedUsdc).toBeCloseTo(5, 6)
})

test('no summary request without a user id', async () => {
  mockUser = null
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(mockSummary).not.toHaveBeenCalled()
  expect(mockTxns).not.toHaveBeenCalled()
})

// ─── paginated feed ───────────────────────────────────────────────────────────

test('the transaction feed is paginated and day-grouped', async () => {
  mockTxns.mockResolvedValueOnce({
    data: [{ id: 't1', created_at: '2026-07-17T10:00:00.000Z' }],
    total: 2,
    limit: 20,
    offset: 0,
  })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.feed.length).toBeGreaterThan(0))
  // groupByDay inserts a day divider ahead of the row.
  expect(result.current.feed.some((f) => f.type === 'day')).toBe(true)

  mockTxns.mockResolvedValueOnce({
    data: [{ id: 't2', created_at: '2026-07-18T10:00:00.000Z' }],
    total: 2,
    limit: 20,
    offset: 1,
  })
  act(() => result.current.loadMoreTransactions())
  await waitFor(() =>
    expect(result.current.feed.filter((f) => f.type === 'item')).toHaveLength(2),
  )
})

test('a later focus re-reads the feed, so the list cannot go stale beside fresh totals', async () => {
  renderHook(() => useWalletScreen())
  await waitFor(() => expect(mockTxns).toHaveBeenCalledTimes(1))
  const summaryCallsAfterMount = mockSummary.mock.calls.length

  // Returning to the tab after approving an escrow: the wallet stays mounted,
  // so without an explicit re-read the EARNED card refreshed while TRANSACTION
  // HISTORY kept showing the pre-approval list.
  await act(async () => { refocus() })
  await waitFor(() => expect(mockTxns).toHaveBeenCalledTimes(2))
  expect(mockSummary.mock.calls.length).toBeGreaterThan(summaryCallsAfterMount)
  // The re-read is page 0, and `reload` keeps whatever pages were scrolled.
  expect(mockTxns.mock.calls[1][1]).toEqual(expect.objectContaining({ offset: 0 }))
})

test('the FIRST focus does not double-fetch the feed', async () => {
  // The controller's query effect already owns page 0 on mount; a focus effect
  // that fetched unconditionally would make every cold open two requests.
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await waitFor(() => expect(mockTxns).toHaveBeenCalledTimes(1))

  await new Promise((r) => setTimeout(r, 20))
  expect(mockTxns).toHaveBeenCalledTimes(1)
})

test('a focus while the feed is gated off does not fire an id-less request', async () => {
  mockUser = null
  renderHook(() => useWalletScreen())
  await act(async () => { refocus() })
  // `enabled` is false, so there is no fetched page to re-read — and calling
  // reload() anyway would request `/users//transactions`.
  expect(mockTxns).not.toHaveBeenCalled()
})

test('the feed has its own loading flag, so the empty state cannot fire early', async () => {
  // The summary is the cheaper query and routinely settles first. Sharing one
  // `isLoading` flashed "No transactions yet" over a feed still in flight.
  let resolveFeed: ((page: TxPage) => void) | undefined
  mockTxns.mockImplementation(() => new Promise<TxPage>((res) => { resolveFeed = res }))

  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.isLoadingTransactions).toBe(true)

  await act(async () => {
    resolveFeed?.({ data: [], total: 0, limit: 20, offset: 0 })
  })
  expect(result.current.isLoadingTransactions).toBe(false)
})

test('the feed is NOT loading when it will never fetch, so the empty state still shows', async () => {
  mockUser = null
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.isLoadingTransactions).toBe(false)
})

test('pull-to-refresh keeps spinning until the FEED lands, not just the totals', async () => {
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))

  let resolveFeed: ((page: TxPage) => void) | undefined
  mockTxns.mockImplementation(() => new Promise<TxPage>((res) => { resolveFeed = res }))

  let refreshed: Promise<void> | undefined
  await act(async () => {
    refreshed = result.current.handleRefresh()
    // Let the balances + summary half settle on its own.
    await Promise.resolve()
  })
  await waitFor(() => expect(result.current.refreshing).toBe(true))

  await act(async () => {
    resolveFeed?.({ data: [], total: 0, limit: 20, offset: 0 })
    await refreshed
  })
  expect(result.current.refreshing).toBe(false)
})

test('signed out → totals reset to zero rather than keeping the previous account', async () => {
  mockUser = null
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.earnedUsdc).toBe(0)
  expect(result.current.spentUsdc).toBe(0)
})

test('a failed balance read empties balances without wedging the screen', async () => {
  mockWallets = [{ chain_ns: 'solana', address: 'SoL' }]
  mockRead.mockRejectedValue(new Error('rpc down'))
  mockSummary.mockResolvedValue({ earned_raw: '3000000', spent_raw: '0', asset: 'USDC_SOL' })

  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.balances).toEqual([])
  // The other half of the screen still loaded — that is what allSettled buys.
  expect(result.current.earnedUsdc).toBeCloseTo(3, 6)
})

test('an unloaded chain registry reads as no chains rather than throwing', async () => {
  mockChains = null
  mockWallets = [{ chain_ns: 'solana', address: 'SoL' }]
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(mockRead).toHaveBeenCalledWith(mockWallets, [])
})
