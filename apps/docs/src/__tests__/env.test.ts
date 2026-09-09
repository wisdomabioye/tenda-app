/**
 * Which deployment the console talks to.
 *
 * The default matters: a contributor with no env file must not have a Run
 * button pointed at production, and a configured URL with a trailing slash
 * must not produce `https://api//v1/gigs`.
 */
import { describe, expect, it } from 'vitest'
import { apiBaseUrl } from '@/env'

describe('apiBaseUrl', () => {
  it('falls back to the local server when nothing is configured', () => {
    expect(apiBaseUrl({} as ImportMetaEnv)).toBe('http://localhost:3000')
    expect(apiBaseUrl({ VITE_API_BASE_URL: '' } as ImportMetaEnv)).toBe('http://localhost:3000')
  })

  it('uses what is configured, without a trailing slash', () => {
    expect(apiBaseUrl({ VITE_API_BASE_URL: 'https://api.tendahq.com' } as ImportMetaEnv)).toBe('https://api.tendahq.com')
    expect(apiBaseUrl({ VITE_API_BASE_URL: 'https://api.tendahq.com//' } as ImportMetaEnv)).toBe('https://api.tendahq.com')
  })
})
