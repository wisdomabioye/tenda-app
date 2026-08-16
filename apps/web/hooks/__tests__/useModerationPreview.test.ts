/**
 * useModerationPreview — debounce, the readiness gate, stale-response
 * discipline, and the silent error path. The verdict is advisory; these
 * tests pin that it can never block or throw.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { previewMock } = vi.hoisted(() => ({ previewMock: vi.fn() }))
vi.mock('@/api/client', () => ({
  api: { moderation: { preview: (...a: unknown[]) => previewMock(...a) } },
}))

import { useModerationPreview, type ModerationPreviewInput } from '@/hooks/useModerationPreview'

const READY: ModerationPreviewInput = {
  title: 'Deliver a package',
  description: 'Careful with it',
  category: 'delivery',
  country: 'NG',
  asset: 'USDC_SOL',
  paymentRaw: 10_000_000,
}

const VERDICT = { decision: 'warn', reasons: [{ code: 'price', message: 'Low budget' }] }

beforeEach(() => {
  vi.useFakeTimers()
  previewMock.mockResolvedValue(VERDICT)
})
afterEach(() => vi.useRealTimers())

async function debounce() {
  await act(async () => {
    vi.advanceTimersByTime(800)
    await Promise.resolve()
    await Promise.resolve()
  })
}

test('fires after the debounce with trimmed fields and the asset decimals', async () => {
  const { result } = renderHook((input: ModerationPreviewInput) => useModerationPreview(input), {
    initialProps: { ...READY, title: '  Deliver a package  ' },
  })
  expect(result.current).toBeNull()
  expect(previewMock).not.toHaveBeenCalled()
  await debounce()
  expect(previewMock).toHaveBeenCalledWith({
    title: 'Deliver a package',
    description: 'Careful with it',
    category: 'delivery',
    country: 'NG',
    asset: 'USDC_SOL',
    amount_raw: '10000000',
    asset_decimals: 6,
  })
  expect(result.current).toEqual(VERDICT)
})

test('not ready (short title / no category / no budget) never calls the API and reads null', async () => {
  for (const input of [
    { ...READY, title: 'abc' },
    { ...READY, category: null },
    { ...READY, country: null },
    { ...READY, paymentRaw: 0 },
  ]) {
    const { result } = renderHook(() => useModerationPreview(input))
    await debounce()
    expect(result.current).toBeNull()
  }
  expect(previewMock).not.toHaveBeenCalled()
})

test('leaving the ready state clears the verdict immediately', async () => {
  const { result, rerender } = renderHook((input: ModerationPreviewInput) => useModerationPreview(input), {
    initialProps: READY,
  })
  await debounce()
  expect(result.current).toEqual(VERDICT)
  rerender({ ...READY, paymentRaw: 0 })
  expect(result.current).toBeNull()
})

test('typing keeps resetting the debounce — one request for a burst of edits', async () => {
  const { rerender } = renderHook((input: ModerationPreviewInput) => useModerationPreview(input), {
    initialProps: READY,
  })
  for (const title of ['Deliver a parcel', 'Deliver a parcel fast', 'Deliver a parcel today']) {
    act(() => {
      vi.advanceTimersByTime(400)
    })
    rerender({ ...READY, title })
  }
  await debounce()
  expect(previewMock).toHaveBeenCalledTimes(1)
  expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Deliver a parcel today' }))
})

test('a stale response can never overwrite the latest verdict', async () => {
  let resolveFirst!: (v: unknown) => void
  previewMock
    .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res }))
    .mockResolvedValueOnce({ decision: 'approve', reasons: [] })
  const { result, rerender } = renderHook((input: ModerationPreviewInput) => useModerationPreview(input), {
    initialProps: READY,
  })
  await debounce() // first request in flight, unresolved
  rerender({ ...READY, title: 'Deliver a parcel now' })
  await debounce() // second request resolves
  expect(result.current).toEqual({ decision: 'approve', reasons: [] })
  await act(async () => {
    resolveFirst(VERDICT) // late first answer — must be dropped
    await Promise.resolve()
  })
  expect(result.current).toEqual({ decision: 'approve', reasons: [] })
})

test('API failure is silent — the hint simply does not show', async () => {
  previewMock.mockRejectedValue(new Error('500'))
  const { result } = renderHook(() => useModerationPreview(READY))
  await debounce()
  expect(result.current).toBeNull()
})
