/**
 * Deterministic Fastify stand-in for e2e. The Next SERVER fetches the public
 * routes during SSR and the BROWSER calls the authed ones (page.route can't
 * intercept server-side fetches, which is why admin's client-mock pattern
 * doesn't work here). Plain node http — no dependencies, boots in
 * milliseconds under Playwright's webServer.
 */
import { createServer, type IncomingMessage } from 'node:http'
import type { GigSummary, PaginatedResponse } from '@tenda/shared'
import {
  deliveryGig,
  deliveryGigDetail,
  E2E_FAIL_GIG_ID,
  E2E_FAIL_QUERY,
  photoGig,
  unbreakableGig,
  unbreakableGigDetail,
} from './fixtures/gigs'
import { handleAuthed } from './fixtures/authed-routes'
import { ENABLED_CHAINS } from './fixtures/chains'
import { errorEnvelope, json, notFoundEnvelope, type StubResponse } from './fixtures/reply'

const PORT = Number(process.env.STUB_API_PORT ?? 3210)
// `unbreakableGig` carries poster-written text at its nastiest (a pasted
// link in the title, the longest real place name). It rides in the FEED so
// the layout checks see it without a special route — see fixtures/gigs.ts.
const GIGS: GigSummary[] = [deliveryGig, photoGig, unbreakableGig]


function handlePublic(url: URL): StubResponse | null {
  if (url.pathname === '/v1/gigs') {
    const category = url.searchParams.get('category')
    const country = url.searchParams.get('country')
    const remote = url.searchParams.get('remote')
    const crossBorder = url.searchParams.get('cross_border')
    const q = url.searchParams.get('q')?.toLowerCase()
    const sort = url.searchParams.get('sort')
    const cursor = url.searchParams.get('cursor')
    const offset = Number(url.searchParams.get('offset') ?? 0)

    // The real route's refusal, mirrored: a keyset cursor is only meaningful
    // under recency ordering, so pairing it with `sort` or `q` is a 400 and
    // NOT an empty page. Without this the stub happily serves a request the
    // production server rejects, which is how the searched feed shipped with
    // no way past its first page and nothing caught it.
    if (cursor !== null && (sort !== null || (q ?? '') !== '')) {
      return errorEnvelope(400, 'Bad Request', 'cursor requires recency ordering', 'VALIDATION_ERROR')
    }

    // Failure injection, keyed off the QUERY rather than a module flag so the
    // e2e suite stays parallel-safe: `?q=<E2E_FAIL_QUERY>` is the one request
    // that fails, and only for the test that asks for it.
    if (q === E2E_FAIL_QUERY) {
      return errorEnvelope(500, 'Internal Server Error', 'gig index down', 'INTERNAL')
    }

    let data = GIGS
    // `?mine=` is the My Gigs column's whole query. The real route scopes it by
    // the caller; this stub has one seeded account, so it serves a fixed
    // subset per bucket — enough for the column to prove that the two tabs are
    // DIFFERENT lists and that a tab survives opening a row, which is what the
    // tests here are about. It models no other ownership.
    const mine = url.searchParams.get('mine')
    if (mine === 'created') data = data.filter((gig) => gig.escrow_id === deliveryGig.escrow_id)
    if (mine === 'working') data = data.filter((gig) => gig.escrow_id === photoGig.escrow_id)
    if (category !== null) data = data.filter((gig) => gig.category === category)
    if (country !== null) data = data.filter((gig) => gig.country === country)
    if (remote === 'true') data = data.filter((gig) => gig.remote)
    if (crossBorder === 'true') data = data.filter((gig) => gig.cross_border)
    if (q !== undefined) data = data.filter((gig) => gig.title.toLowerCase().includes(q))
    if (sort === 'amount_asc' || sort === 'amount_desc') {
      // BigInt COMPARISON, not subtraction-to-Number: base units routinely
      // exceed Number.MAX_SAFE_INTEGER, and this file's tsconfig target has
      // no BigInt literals to write the multiplier with anyway.
      const ascending = sort === 'amount_asc'
      data = [...data].sort((a, b) => {
        const left = BigInt(a.amount_raw)
        const right = BigInt(b.amount_raw)
        if (left === right) return 0
        const lower = left < right
        return (lower ? -1 : 1) * (ascending ? 1 : -1)
      })
    }

    const total = data.length
    const page: PaginatedResponse<GigSummary> = {
      data: data.slice(offset, offset + 20),
      total,
      limit: 20,
      offset,
      // Minted only for the plain recency feed, exactly like the real route:
      // a sorted or searched response omits the field entirely.
      ...(sort === null && (q ?? '') === '' ? { next_cursor: null } : {}),
    }
    return json(page)
  }
  const detailMatch = url.pathname.match(/^\/v1\/gigs\/([^/]+)$/)
  if (detailMatch !== null) {
    const id = detailMatch[1]
    // The takedown contract: a hidden gig is a 404 for anonymous readers.
    if (id === 'hidden-gig') return notFoundEnvelope('gig is not available')
    // Outage, distinct from a 404: the page must say so rather than 404.
    if (id === E2E_FAIL_GIG_ID) {
      return errorEnvelope(500, 'Internal Server Error', 'gig index down', 'INTERNAL')
    }
    if (id === deliveryGigDetail.escrow_id) return json(deliveryGigDetail)
    if (id === unbreakableGigDetail.escrow_id) return json(unbreakableGigDetail)
    return notFoundEnvelope('no such gig')
  }
  if (url.pathname === '/v1/platform/config') {
    return json({ fee_bps: 250, seeker_fee_bps: 100, grace_period_seconds: 3600 })
  }
  if (url.pathname === '/v1/platform/chains') {
    return json({ data: ENABLED_CHAINS })
  }
  return null
}


function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    request.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })
    request.on('end', () => resolve(data))
  })
}

/**
 * CORS mirrors the real Fastify's dev posture (CORS_ORIGIN unset = mirror any
 * origin): the BROWSER calls the authed routes cross-origin (:3211 → :3210),
 * so without these headers every client-side call is blocked before it leaves.
 */
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE',
  'access-control-allow-headers': 'content-type, authorization',
} as const

createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`)
    const method = request.method ?? 'GET'
    if (method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS)
      response.end()
      return
    }
    const body = method === 'GET' ? '' : await readBody(request)
    const result =
      handleAuthed(url, method, request.headers.authorization, body) ??
      handlePublic(url) ??
      notFoundEnvelope(`route ${method} ${url.pathname} not stubbed`)
    response.writeHead(result.statusCode, { 'content-type': 'application/json', ...CORS_HEADERS })
    response.end(result.body)
  })()
}).listen(PORT, () => {
  console.log(`stub api listening on :${PORT}`)
})

