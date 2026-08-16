/**
 * lib/env — NEXT_PUBLIC_APP_ENV → AppEnv mapping. The dangerous edge is a
 * production build with no explicit APP_ENV silently targeting the dev API;
 * that falls back to 'development' but must complain loudly.
 */
import { afterEach, vi } from 'vitest'
import { getEnv } from '@/lib/config/env'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getEnv', () => {
  it('returns staging when NEXT_PUBLIC_APP_ENV=staging', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging')
    expect(getEnv()).toBe('staging')
  })

  it('returns production when NEXT_PUBLIC_APP_ENV=production', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')
    expect(getEnv()).toBe('production')
  })

  it('falls back to development when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
    expect(getEnv()).toBe('development')
  })

  it('treats an unknown value as development, not a crash', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'qa')
    expect(getEnv()).toBe('development')
  })

  it('complains loudly when a production build has no APP_ENV', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
    vi.stubEnv('NODE_ENV', 'production')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(getEnv()).toBe('development')

    expect(error).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_APP_ENV'))
  })

  it('stays quiet about the fallback outside production builds', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(getEnv()).toBe('development')

    expect(error).not.toHaveBeenCalled()
  })
})
