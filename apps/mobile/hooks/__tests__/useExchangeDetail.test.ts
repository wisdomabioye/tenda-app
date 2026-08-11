/**
 * useExchangeDetail — what a refetch failure does to the offer already on
 * screen.
 *
 * The hook refetches on every focus, so a failure here is not a first-load
 * failure: there is usually a good offer rendered behind it. Whether that offer
 * survives is the whole behaviour. It must NOT survive a 404 — the offer was
 * deleted, or taken down and no longer readable by this viewer, and the screen
 * would otherwise keep an Accept button live over a listing the server has
 * stopped serving. It MUST survive anything else, or a lost packet blanks a
 * perfectly good screen.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { ExchangeDetail } from '@tenda/shared'
import { ApiClientError } from '@/api/client'
import { exchangeDetail } from '@/components/exchange/__fixtures__/exchange-detail'

const mockGet = jest.fn()
jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  api: { exchange: { get: (...args: unknown[]) => mockGet(...args) } },
}))

// Captured so a test can re-fire it — the second focus IS the refetch.
let focusCb: (() => void) | null = null
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    focusCb = cb
  },
}))

import { useExchangeDetail } from '@/hooks/useExchangeDetail'

const OFFER: ExchangeDetail = exchangeDetail({ escrow_id: 'offer-1' })

beforeEach(() => {
  focusCb = null
  mockGet.mockReset()
})

/** Mount, run the focus effect, and wait for the first response to land. */
async function mountLoaded() {
  mockGet.mockResolvedValue(OFFER)
  const hook = renderHook(() => useExchangeDetail('offer-1'))
  await act(async () => {
    focusCb?.()
  })
  await waitFor(() => expect(hook.result.current.offer).toEqual(OFFER))
  return hook
}

test('loads the offer and clears the loading flag', async () => {
  const { result } = await mountLoaded()
  expect(mockGet).toHaveBeenCalledWith({ id: 'offer-1' })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.error).toBeNull()
})

test('an absent id fetches nothing', async () => {
  renderHook(() => useExchangeDetail(undefined))
  await act(async () => {
    focusCb?.()
  })
  expect(mockGet).not.toHaveBeenCalled()
})

test('a 404 refetch DROPS the offer it was refreshing', async () => {
  const { result } = await mountLoaded()

  mockGet.mockRejectedValue(new ApiClientError(404, 'Not Found', 'Offer not found', 'NOT_FOUND'))
  await act(async () => {
    await result.current.refresh()
  })

  expect(result.current.offer).toBeNull()
  expect(result.current.error).toEqual({ message: 'Offer not found', gone: true })
})

test('a NETWORK refetch keeps the offer on screen', async () => {
  const { result } = await mountLoaded()

  mockGet.mockRejectedValue(new Error('Network request failed'))
  await act(async () => {
    await result.current.refresh()
  })

  expect(result.current.offer).toEqual(OFFER)
  expect(result.current.error?.gone).toBe(false)
})

test('a 500 refetch keeps the offer too', async () => {
  const { result } = await mountLoaded()

  mockGet.mockRejectedValue(new ApiClientError(500, 'Internal', 'Boom', 'INTERNAL_ERROR'))
  await act(async () => {
    await result.current.refresh()
  })

  expect(result.current.offer).toEqual(OFFER)
  expect(result.current.error?.gone).toBe(false)
})

test('a successful refetch clears a previous failure', async () => {
  const { result } = await mountLoaded()
  mockGet.mockRejectedValue(new Error('Network request failed'))
  await act(async () => {
    await result.current.refresh()
  })
  expect(result.current.error).not.toBeNull()

  const updated: ExchangeDetail = { ...OFFER, hidden: true }
  mockGet.mockResolvedValue(updated)
  await act(async () => {
    await result.current.refresh()
  })

  expect(result.current.error).toBeNull()
  // And the takedown flag rides in on the ordinary refetch — no extra plumbing.
  expect(result.current.offer?.hidden).toBe(true)
})
