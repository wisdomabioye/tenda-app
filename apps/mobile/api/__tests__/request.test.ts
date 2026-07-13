/**
 * api/request, HTTP core. Pins the Authorization contract: the stored JWT is
 * attached by default, and `auth: false` forces an anonymous call even when a
 * token is stored (sign-in surfaces depend on this, the server treats a
 * present bearer on /v1/auth/{challenge,verify} as link intent and hard-401s
 * a stale one). Plus the ApiError envelope → ApiClientError mapping.
 */

jest.mock('@/lib/secure-store', () => ({
  getJwtToken: jest.fn(),
}))

import { request, ApiClientError } from '@/api/request'
import { getJwtToken } from '@/lib/secure-store'

const getJwt = getJwtToken as jest.Mock

function mockFetch(status = 200, body: unknown = { ok: true }): jest.Mock {
  const fetchMock = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    json: async () => body,
  }))
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function sentHeaders(fetchMock: jest.Mock): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers
}

describe('request, Authorization header', () => {
  it('attaches the stored JWT by default', async () => {
    getJwt.mockResolvedValue('jwt-abc')
    const fetchMock = mockFetch()

    await request('GET', '/v1/users/me')

    expect(sentHeaders(fetchMock)['Authorization']).toBe('Bearer jwt-abc')
  })

  it('sends no header when nothing is stored', async () => {
    getJwt.mockResolvedValue(null)
    const fetchMock = mockFetch()

    await request('GET', '/v1/gigs')

    expect(sentHeaders(fetchMock)['Authorization']).toBeUndefined()
  })

  it('auth: false forces an anonymous call even with a stored token', async () => {
    getJwt.mockResolvedValue('stale-jwt')
    const fetchMock = mockFetch()

    await request('POST', '/v1/auth/verify', {
      body: { method: 'email', identifier: 'a@x.io', code: '123456' },
      auth: false,
    })

    expect(sentHeaders(fetchMock)['Authorization']).toBeUndefined()
    // The anonymous flag must not touch the rest of the request.
    expect(sentHeaders(fetchMock)['Content-Type']).toBe('application/json')
    expect(getJwt).not.toHaveBeenCalled()
  })

  it('auth: true keeps the default attach behaviour', async () => {
    getJwt.mockResolvedValue('jwt-link')
    const fetchMock = mockFetch()

    await request('POST', '/v1/auth/verify', {
      body: { method: 'email', identifier: 'a@x.io', code: '123456' },
      auth: true,
    })

    expect(sentHeaders(fetchMock)['Authorization']).toBe('Bearer jwt-link')
  })
})

describe('request, timeout budget', () => {
  it('honours a per-request timeout override (moderation-bearing calls)', async () => {
    getJwt.mockResolvedValue(null)
    mockFetch()
    const spy = jest.spyOn(global, 'setTimeout')

    await request('POST', '/v1/gigs', { body: {}, timeout: 20_000 })

    const delays = spy.mock.calls.map((c) => c[1])
    expect(delays).toContain(20_000)
    spy.mockRestore()
  })

  it('falls back to the env default timeout when no override is given', async () => {
    getJwt.mockResolvedValue(null)
    mockFetch()
    const spy = jest.spyOn(global, 'setTimeout')

    await request('POST', '/v1/gigs', { body: {} })

    const delays = spy.mock.calls.map((c) => c[1])
    // The env default (5s dev / 10s staging / 15s prod) is the reason gig
    // creation aborted mid-moderation — it must NOT silently pick 20s here.
    expect(delays).not.toContain(20_000)
    expect(delays.some((d) => typeof d === 'number' && d > 0)).toBe(true)
    spy.mockRestore()
  })
})

describe('request, error envelope', () => {
  it('maps a non-2xx ApiError envelope to ApiClientError with its code', async () => {
    getJwt.mockResolvedValue(null)
    mockFetch(401, {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or missing token',
      code: 'UNAUTHORIZED',
    })

    const pending = request('GET', '/v1/users/me')
    await expect(pending).rejects.toBeInstanceOf(ApiClientError)
    await expect(pending).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing token',
    })
  })
})
