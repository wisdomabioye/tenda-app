/**
 * The two exchange routes' own decisions: the advanced-mode gate, and the
 * split between an offer that is GONE and one that merely failed to load.
 *
 * That split is the point of this file. Collapsing them sends a reader back to
 * the order book for an offer that is still there and still theirs to take.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DetailLoadError, ExchangeDetail } from '@tenda/shared'
import ExchangePage from '@/app/(app)/exchange/page'
import ExchangeDetailPage from '@/app/(app)/exchange/[id]/page'
import { EXCHANGE_COPY } from '@/components/exchange/market'
import { OFFER_DETAIL_COPY } from '@/components/exchange/detail'
import { useAuthStore } from '@/stores/auth.store'
import { makeUser } from '../../../../test/factories/user'
import { makeExchangeDetail } from '../../../../test/factories/exchange'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/exchange',
  useParams: () => ({ id: 'exch-1' }),
}))

const screenState = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/hooks/exchange/useExchangeScreen', () => ({
  useExchangeScreen: (filters: unknown) => {
    screenState.calls.push(filters)
    const list = {
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
    }
    return { market: list, myTrades: list }
  },
}))

const detail = vi.hoisted(() => ({
  offer: null as ExchangeDetail | null,
  isLoading: false,
  error: null as DetailLoadError | null,
  refresh: vi.fn(async () => {}),
}))
vi.mock('@/hooks/exchange/useExchangeDetail', () => ({
  useExchangeDetail: () => detail,
}))
vi.mock('@/components/exchange', () => ({
  ExchangeDetailApp: () => <p>offer body</p>,
}))
vi.mock('@/stores/chain-registry.store', () => ({
  useChainRegistryStore: (select: (s: { chains: null; ensureLoaded: () => void }) => unknown) =>
    select({ chains: null, ensureLoaded: () => undefined }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  screenState.calls = []
  detail.offer = null
  detail.isLoading = false
  detail.error = null
  useAuthStore.setState({ user: makeUser({ id: 'me', advanced_mode_enabled: true }) })
})

describe('/exchange', () => {
  it('shows the order book once the toggle is on', () => {
    render(<ExchangePage />)
    expect(screen.getByRole('heading', { level: 1, name: EXCHANGE_COPY.title('market') })).toBeInTheDocument()
  })

  it('locks the surface — and fetches NOTHING — when advanced mode is off', () => {
    // Both endpoints enforce the same gate, so requesting would only paint a
    // refusal over the one message that helps: turn it on in Settings.
    useAuthStore.setState({ user: makeUser({ id: 'me', advanced_mode_enabled: false }) })
    render(<ExchangePage />)
    expect(screen.getByText(EXCHANGE_COPY.locked.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: EXCHANGE_COPY.locked.action })).toHaveAttribute(
      'href',
      '/settings',
    )
    expect(screenState.calls).toEqual([
      expect.objectContaining({ enabled: false }),
    ])
  })
})

describe('/exchange/[id]', () => {
  it('renders the offer when it loads', () => {
    detail.offer = makeExchangeDetail()
    render(<ExchangeDetailPage />)
    expect(screen.getByText('offer body')).toBeInTheDocument()
  })

  it('shows nothing but a spinner while it is still loading', () => {
    detail.isLoading = true
    render(<ExchangeDetailPage />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('offer body')).toBeNull()
  })

  it('sends a reader back to the book when the offer is GONE', () => {
    detail.error = { gone: true, message: 'not found' }
    render(<ExchangeDetailPage />)
    expect(screen.getByText(OFFER_DETAIL_COPY.unavailableTitle)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: OFFER_DETAIL_COPY.back })).toHaveAttribute(
      'href',
      '/exchange',
    )
    // No retry: re-reading a deleted offer produces the same 404.
    expect(screen.queryByRole('button', { name: OFFER_DETAIL_COPY.retry })).toBeNull()
  })

  it('offers a RETRY when the read merely failed', async () => {
    detail.error = { gone: false, message: 'network down' }
    render(<ExchangeDetailPage />)
    expect(screen.getByText(OFFER_DETAIL_COPY.loadFailedTitle)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: OFFER_DETAIL_COPY.retry }))
    expect(detail.refresh).toHaveBeenCalledTimes(1)
  })
})
