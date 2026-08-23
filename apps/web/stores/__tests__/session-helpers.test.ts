/**
 * stores/auth/session-helpers — the retry predicate the wallets[] loader
 * feeds to withRetry: transient failures retry, dead tokens surface at once.
 */
import { describe, expect, it } from 'vitest'
import { ApiClientError } from '@tenda/shared'
import { isRetriableMeError } from '@/stores/auth/session-helpers'

describe('isRetriableMeError', () => {
  it('retries transient failures — network errors and 5xx', () => {
    expect(isRetriableMeError(new Error('fetch failed'))).toBe(true)
    expect(isRetriableMeError(new ApiClientError(503, 'Service Unavailable', 'down'))).toBe(true)
  })

  it('never retries a terminal auth failure (401/403 → re-authenticate)', () => {
    expect(isRetriableMeError(new ApiClientError(401, 'Unauthorized', 'dead token'))).toBe(false)
    expect(isRetriableMeError(new ApiClientError(403, 'Forbidden', 'forbidden'))).toBe(false)
  })
})
