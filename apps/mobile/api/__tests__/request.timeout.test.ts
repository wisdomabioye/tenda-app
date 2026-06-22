/**
 * request() timeout handling. Guards the OTP-challenge fix: an endpoint whose
 * server budget (email/SMS send, up to 15s) exceeds the default profile
 * timeout (dev 5s) must be able to opt into a longer per-call deadline.
 * Without it the client aborts mid-send and surfaces a false error even though
 * the OTP was actually delivered.
 */

jest.mock('@/lib/env', () => ({ getEnv: () => 'development' }))
jest.mock('@/lib/secure-store', () => ({ getJwtToken: async () => null }))
jest.mock('@tenda/shared', () => ({
  apiConfig: { development: { baseUrl: 'http://test.local', timeout: 5000, retries: 0 } },
}))

import { request } from '@/api/request'

/** Capture the AbortSignal handed to fetch; never resolve (so only the timeout
 *  controller can settle the call). */
function stubNeverResolvingFetch(): { signal: () => AbortSignal | undefined } {
  let captured: AbortSignal | undefined
  global.fetch = jest.fn((_url: string, init?: { signal?: AbortSignal }) => {
    captured = init?.signal
    return new Promise(() => {}) as Promise<Response>
  }) as unknown as typeof fetch
  return { signal: () => captured }
}

describe('request() timeout', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('aborts at the default profile timeout when no override is given', async () => {
    const f = stubNeverResolvingFetch()
    void request('POST', '/v1/auth/challenge', { body: {} })
    await Promise.resolve() // let the async request body reach fetch()

    jest.advanceTimersByTime(4999)
    expect(f.signal()?.aborted).toBe(false)
    jest.advanceTimersByTime(1)
    expect(f.signal()?.aborted).toBe(true)
  })

  it('honours a longer per-call timeoutMs over the default', async () => {
    const f = stubNeverResolvingFetch()
    void request('POST', '/v1/auth/challenge', { body: {}, timeoutMs: 20000 })
    await Promise.resolve()

    // Past the 5s default the request must still be in-flight (this is the bug fix).
    jest.advanceTimersByTime(5000)
    expect(f.signal()?.aborted).toBe(false)
    // Only at the override deadline does it abort.
    jest.advanceTimersByTime(15000)
    expect(f.signal()?.aborted).toBe(true)
  })
})
