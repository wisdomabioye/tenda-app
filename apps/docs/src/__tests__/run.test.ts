/**
 * The console sends real requests, so it is tested against a fake fetch rather
 * than a real one: what matters is the SEQUENCE (mint a demo bearer, then send
 * the documented body) and what a reader is told when it fails.
 *
 * The failure case is the one worth the most: a cross-origin refusal arrives
 * as a bare network error, and a console that printed "failed" would send the
 * reader looking at their own code instead of at the header the deployment is
 * missing.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ExampleValue, OperationObject } from '@tenda/api-doc'
import { apiRoutes } from '@tenda/shared/api-routes'
import { isRunnable, runOperation } from '@/lib/run'

const API = 'https://api.example.test'

const anonymous: OperationObject = {
  operationId: 'listGigs', summary: 'Browse', description: '', tags: ['gigs'],
  responses: { '200': { description: 'ok' } },
}
const bearerScoped: OperationObject = {
  ...anonymous,
  operationId: 'postAgentTask',
  security: [{ bearer: [] }],
  requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' }, example: { title: 'Paint the fence' } } } },
}

const jsonResponse = (status: number, body: ExampleValue): Response =>
  ({ status, text: () => Promise.resolve(JSON.stringify(body)) }) as Response

describe('isRunnable', () => {
  it('refuses a path with a placeholder the console cannot fill', () => {
    expect(isRunnable('/v1/gigs')).toBe(true)
    expect(isRunnable('/v1/gigs/{id}')).toBe(false)
  })
})

describe('runOperation', () => {
  it('sends an anonymous operation with no token and no body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }))
    const outcome = await runOperation({ api: API, method: 'GET', path: '/v1/gigs', operation: anonymous, fetchImpl, now: () => 0 })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${API}/v1/gigs`)
    expect(init.body).toBeUndefined()
    expect(init.headers.authorization).toBeUndefined()
    expect(outcome).toMatchObject({ ok: true, result: { status: 200, body: { data: [] } } })
  })

  it('mints the demo bearer FIRST, then sends the documented body with it', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 'demo-token' }))
      .mockResolvedValueOnce(jsonResponse(402, { x402Version: 1 }))
    const outcome = await runOperation({ api: API, method: 'POST', path: '/v1/agent/tasks', operation: bearerScoped, fetchImpl, now: () => 0 })

    expect(fetchImpl.mock.calls[0][0]).toBe(`${API}${apiRoutes.agent.demoSession}`)
    const [, init] = fetchImpl.mock.calls[1]
    expect(init.headers.authorization).toBe('Bearer demo-token')
    expect(init.headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ title: 'Paint the fence' })
    expect(outcome).toMatchObject({ ok: true, result: { status: 402 } })
  })

  it('says what is wrong when the demo session answers no token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, { message: 'no demo agent configured' }))
    const outcome = await runOperation({ api: API, method: 'POST', path: '/v1/agent/tasks', operation: bearerScoped, fetchImpl, now: () => 0 })

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.failure.message).toContain(apiRoutes.agent.demoSession)
  })

  it('names CORS when the request never reaches the server', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const outcome = await runOperation({ api: API, method: 'GET', path: '/v1/gigs', operation: anonymous, fetchImpl, now: () => 0 })

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.failure.message).toMatch(/CORS/)
    expect(outcome.ok === false && outcome.failure.message).toContain(API)
  })

  it('shows a non-JSON answer rather than throwing on it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 502, text: () => Promise.resolve('<html>bad gateway</html>') } as Response)
    const outcome = await runOperation({ api: API, method: 'GET', path: '/v1/gigs', operation: anonymous, fetchImpl, now: () => 0 })

    expect(outcome).toMatchObject({ ok: true, result: { status: 502, body: '<html>bad gateway</html>' } })
  })

  it('reports the round trip, so a reader sees how fast the 402 is', async () => {
    const clock = vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_180)
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    const outcome = await runOperation({ api: API, method: 'GET', path: '/v1/gigs', operation: anonymous, fetchImpl, now: clock })

    expect(outcome.ok === true && outcome.result.ms).toBe(180)
  })
})
