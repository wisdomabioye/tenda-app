/**
 * The coordinator's whole job: concurrent triggers coalesce into at most
 * one trailing run (the final consistency read is never dropped), errors
 * are contained, and stop() ends everything including a queued trailing.
 */
import { expect, test, vi } from 'vitest'
import { createRefreshCoordinator } from '@/hooks/escrow/live/refresh-coordinator'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

test('requests during a running refresh coalesce into ONE trailing run', async () => {
  const gate = deferred()
  const refresh = vi.fn(() => gate.promise)
  const c = createRefreshCoordinator(refresh)

  c.request()
  c.request()
  c.request()
  expect(refresh).toHaveBeenCalledTimes(1)

  gate.resolve()
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2)) // one trailing, not two
})

test('a rejecting refresh is contained and the loop stays usable', async () => {
  const refresh = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue()
  const c = createRefreshCoordinator(refresh)
  c.request()
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  c.request()
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
})

test('stop() cancels a queued trailing run and blocks future requests', async () => {
  const gate = deferred()
  const refresh = vi.fn(() => gate.promise)
  const c = createRefreshCoordinator(refresh)
  c.request()
  c.request() // trailing queued
  c.stop()
  gate.resolve()
  await Promise.resolve()
  c.request() // after stop: ignored
  expect(refresh).toHaveBeenCalledTimes(1)
})
