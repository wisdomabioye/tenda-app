/**
 * gigsApi / applicationsApi — verb, route and payload per method.
 *
 * Two behaviours here are not table-shaped and get their own tests: `create`
 * carries the moderation timeout (it waits on a content check, not just a
 * write), and `apply` defaults its body to `{}` so an application with no
 * message still sends a body rather than `undefined`.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRoutes } from '@tenda/shared'
import { request } from '../../request'
import { applicationsApi, gigsApi } from '../gigs'
import { MODERATION_TIMEOUT_MS } from '../timeouts'
import { expectClientCall, type ClientCase } from '../__fixtures__/client-table'

vi.mock('../../request', () => ({ request: vi.fn() }))

const requestMock = vi.mocked(request)
const { gigs, applications } = apiRoutes
const id = { id: 'gig-1' }

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({})
})

const CASES: ClientCase[] = [
  { name: 'featured', call: () => gigsApi.featured(), method: 'GET', path: gigs.featured },
  {
    name: 'list (query omitted)',
    call: () => gigsApi.list(),
    method: 'GET',
    path: gigs.list,
    options: { query: undefined },
  },
  {
    name: 'list (query given)',
    call: () => gigsApi.list({ mine: 'working', status: ['completed'], limit: 1 }),
    method: 'GET',
    path: gigs.list,
    options: { query: { mine: 'working', status: ['completed'], limit: 1 } },
  },
  {
    name: 'facets (query given)',
    call: () => gigsApi.facets({ category: 'delivery' }),
    method: 'GET',
    path: gigs.facets,
    options: { query: { category: 'delivery' } },
  },
  { name: 'get (scoped)', call: () => gigsApi.get(id), method: 'GET', path: gigs.get, options: { params: id } },
  {
    name: 'applicants (scoped, query omitted)',
    call: () => gigsApi.applicants(id),
    method: 'GET',
    path: gigs.applicants,
    options: { params: id, query: undefined },
  },
  {
    name: 'applicants (scoped, query given)',
    call: () => gigsApi.applicants(id, { status: ['open'] }),
    method: 'GET',
    path: gigs.applicants,
    options: { params: id, query: { status: ['open'] } },
  },
  {
    name: 'withdrawApplication (scoped)',
    call: () => gigsApi.withdrawApplication(id),
    method: 'DELETE',
    path: gigs.withdrawApplication,
    options: { params: id },
  },
  {
    name: 'applications.mine (query given)',
    call: () => applicationsApi.mine({ limit: 20 }),
    method: 'GET',
    path: applications.mine,
    options: { query: { limit: 20 } },
  },
]

test.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
  await expectClientCall(requestMock, testCase)
})

test('create waits on the MODERATION budget, not the default request timeout', async () => {
  // Publishing runs the Stage-6 content gate server-side; the default timeout
  // would abort a request that was going to succeed.
  const body = { escrow_id: 'e1', title: 'Deliver a parcel', category: 'delivery' as const, country: 'NG', city: 'Lagos' }
  await gigsApi.create(body)
  expect(requestMock).toHaveBeenLastCalledWith('POST', gigs.create, {
    body,
    timeout: MODERATION_TIMEOUT_MS,
  })
})

test('apply sends an EMPTY body when there is no message, never undefined', async () => {
  await gigsApi.apply(id)
  expect(requestMock).toHaveBeenLastCalledWith('POST', gigs.apply, { params: id, body: {} })

  await gigsApi.apply(id, { message: 'I can do this' })
  expect(requestMock).toHaveBeenLastCalledWith('POST', gigs.apply, {
    params: id,
    body: { message: 'I can do this' },
  })
})
