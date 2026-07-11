/**
 * useEscrowLiveRefresh — the #4 fix. Detail screens previously refreshed only
 * on focus, so a counterparty's action never showed live. This hook subscribes
 * to the escrow WS channel and refetches (debounced) on any frame, and cleanly
 * unsubscribes on unmount.
 */
import { renderHook, act } from '@testing-library/react-native'

type FrameCb = () => void
const mockUnsub = jest.fn()
const mockSubscribe = jest.fn<() => void, [string, FrameCb]>()
jest.mock('@/stores/realtime.store', () => ({
  subscribeEscrowChannel: (id: string, cb: FrameCb) => mockSubscribe(id, cb),
}))

import { useEscrowLiveRefresh } from '@/hooks/useEscrowLiveRefresh'

/** Invoke the frame callback the hook registered (simulate an inbound frame). */
function fireFrame(): void {
  mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1][1]()
}

beforeEach(() => {
  jest.useFakeTimers()
  mockSubscribe.mockReset()
  mockUnsub.mockReset()
  mockSubscribe.mockReturnValue(mockUnsub)
})
afterEach(() => { jest.useRealTimers() })

test('subscribes to the escrow channel by id', () => {
  const refresh = jest.fn()
  renderHook(() => useEscrowLiveRefresh('e1', refresh))
  expect(mockSubscribe).toHaveBeenCalledWith('e1', expect.any(Function))
})

test('a frame triggers exactly one debounced refresh', () => {
  const refresh = jest.fn()
  renderHook(() => useEscrowLiveRefresh('e1', refresh))
  act(() => { fireFrame() })
  expect(refresh).not.toHaveBeenCalled() // debounced, not immediate
  act(() => { jest.advanceTimersByTime(400) })
  expect(refresh).toHaveBeenCalledTimes(1)
})

test('a burst of frames coalesces into a single refresh', () => {
  const refresh = jest.fn()
  renderHook(() => useEscrowLiveRefresh('e1', refresh))
  act(() => { fireFrame(); fireFrame(); fireFrame() })
  act(() => { jest.advanceTimersByTime(400) })
  expect(refresh).toHaveBeenCalledTimes(1)
})

test('always calls the LATEST refresh, without resubscribing', () => {
  const first = jest.fn()
  const second = jest.fn()
  const { rerender } = renderHook<void, { r: () => void }>(
    ({ r }) => useEscrowLiveRefresh('e1', r),
    { initialProps: { r: first } },
  )
  rerender({ r: second })
  expect(mockSubscribe).toHaveBeenCalledTimes(1) // stable subscription
  act(() => { fireFrame() })
  act(() => { jest.advanceTimersByTime(400) })
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
})

test('unmount unsubscribes and cancels a pending refresh', () => {
  const refresh = jest.fn()
  const { unmount } = renderHook(() => useEscrowLiveRefresh('e1', refresh))
  act(() => { fireFrame() })
  unmount()
  expect(mockUnsub).toHaveBeenCalledTimes(1)
  act(() => { jest.advanceTimersByTime(400) })
  expect(refresh).not.toHaveBeenCalled() // pending timer cleared on unmount
})

test('no escrow id → no subscription', () => {
  renderHook(() => useEscrowLiveRefresh(undefined, jest.fn()))
  expect(mockSubscribe).not.toHaveBeenCalled()
})
