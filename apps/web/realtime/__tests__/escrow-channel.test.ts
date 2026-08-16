/**
 * The stage-5 stub contract: subscriptions are inert (no frames, ever) and
 * the returned unsubscribe is callable. When S5.1 replaces this with the
 * real socket, the escrow-sync suite's mocked-frame tests define the wire
 * behavior — this file only pins the stub's "safe no-op" shape.
 */
import { expect, test, vi } from 'vitest'
import { subscribeEscrowChannel } from '@/realtime/escrow-channel'

test('subscribe returns a callable unsubscribe and never emits', () => {
  const onFrame = vi.fn()
  const unsubscribe = subscribeEscrowChannel('e1', onFrame)
  expect(onFrame).not.toHaveBeenCalled()
  expect(() => unsubscribe()).not.toThrow()
})
