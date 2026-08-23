import { act, render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { GigFeedServerFrame } from '@tenda/shared'

const seams = vi.hoisted(() => ({
  listener: null as ((event: GigFeedServerFrame) => void) | null,
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: seams.refresh }) }))
vi.mock('@/hooks/connectivity/useRealtimeConnection', () => ({ useRealtimeConnection: vi.fn() }))
vi.mock('@/stores/realtime.store', () => ({
  useRealtimeStore: (select: (state: { connected: boolean }) => boolean) => select({ connected: true }),
  subscribeGigFeedChannel: (listener: (event: GigFeedServerFrame) => void) => {
    seams.listener = listener
    return () => { seams.listener = null }
  },
}))

import { PublicGigFeedRealtime } from '@/components/gig/feed/PublicGigFeedRealtime'
import { useAuthStore } from '@/stores/auth.store'

beforeEach(() => {
  seams.listener = null
  useAuthStore.setState({ isLoading: false, isAuthenticated: false })
})

it('refreshes the server-rendered feed when a socket frame arrives', () => {
  render(<PublicGigFeedRealtime />)
  seams.refresh.mockClear()
  act(() => seams.listener?.({
    type: 'gig_unavailable', channel: 'feed:gigs', event_id: 'evt-1', escrow_id: 'gig-1',
    gig_revision: '2', occurred_at: '2026-08-23T00:00:00.000Z', cause: 'accepted',
  }))
  expect(seams.refresh).toHaveBeenCalledOnce()
})

it('coalesces a burst of frames into one refresh', () => {
  vi.useFakeTimers()
  render(<PublicGigFeedRealtime />)
  seams.refresh.mockClear()
  act(() => {
    seams.listener?.({ type: 'gig_unavailable', channel: 'feed:gigs', event_id: 'a', escrow_id: 'gig-1', gig_revision: '2', occurred_at: '2026-08-23T00:00:00.000Z', cause: 'accepted' })
    seams.listener?.({ type: 'gig_unavailable', channel: 'feed:gigs', event_id: 'b', escrow_id: 'gig-2', gig_revision: '2', occurred_at: '2026-08-23T00:00:00.000Z', cause: 'accepted' })
  })
  expect(seams.refresh).toHaveBeenCalledOnce()
  act(() => vi.runAllTimers())
  vi.useRealTimers()
})
