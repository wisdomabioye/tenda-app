/**
 * Deterministic Fastify stand-in for e2e. The Next SERVER fetches these
 * routes during SSR (page.route can't intercept server-side fetches, which is
 * why admin's client-mock pattern doesn't work here). Plain node http — no
 * dependencies, boots in milliseconds under Playwright's webServer.
 */
import { createServer } from 'node:http'
import type { ChainRegistryEntry, GigSummary, PaginatedResponse } from '@tenda/shared'
import { deliveryGig, deliveryGigDetail, photoGig } from './fixtures/gigs'

const PORT = Number(process.env.STUB_API_PORT ?? 3210)
const GIGS: GigSummary[] = [deliveryGig, photoGig]

/** The RUNNING registry: dev chains only — the filter must offer exactly these. */
const ENABLED_CHAINS: ChainRegistryEntry[] = [
  {
    id: 'solana:devnet',
    namespace: 'solana',
    display_name: 'Solana Devnet',
    escrow_address: 'Escrw111111111111111111111111111111111111111',
    assets: [
      { id: 'USDC_SOL', symbol: 'USDC', decimals: 6, is_stable: true, token_address: 'Mint1111', supports_permit: false },
    ],
  },
  {
    id: 'eip155:84532',
    namespace: 'eip155',
    display_name: 'Base Sepolia',
    escrow_address: '0x000000000000000000000000000000000000e5c1',
    assets: [
      { id: 'USDC_BASE', symbol: 'USDC', decimals: 6, is_stable: true, token_address: '0xusdc', supports_permit: true },
    ],
  },
]

function json(body: unknown, statusCode = 200) {
  return { statusCode, body: JSON.stringify(body) }
}

function notFoundEnvelope(message: string) {
  return json({ statusCode: 404, error: 'Not Found', message, code: 'NOT_FOUND' }, 404)
}

function handle(url: URL): { statusCode: number; body: string } {
  if (url.pathname === '/v1/gigs') {
    const category = url.searchParams.get('category')
    const remote = url.searchParams.get('remote')
    const q = url.searchParams.get('q')?.toLowerCase()
    let data = GIGS
    if (category !== null) data = data.filter((gig) => gig.category === category)
    if (remote === 'true') data = data.filter((gig) => gig.remote)
    if (q !== undefined) data = data.filter((gig) => gig.title.toLowerCase().includes(q))
    const page: PaginatedResponse<GigSummary> = {
      data,
      total: data.length,
      limit: 20,
      offset: 0,
      next_cursor: null,
    }
    return json(page)
  }
  const detailMatch = url.pathname.match(/^\/v1\/gigs\/([^/]+)$/)
  if (detailMatch !== null) {
    const id = detailMatch[1]
    // The takedown contract: a hidden gig is a 404 for anonymous readers.
    if (id === 'hidden-gig') return notFoundEnvelope('gig is not available')
    if (id === deliveryGigDetail.escrow_id) return json(deliveryGigDetail)
    return notFoundEnvelope('no such gig')
  }
  if (url.pathname === '/v1/platform/config') {
    return json({ fee_bps: 250, seeker_fee_bps: 100, grace_period_seconds: 3600 })
  }
  if (url.pathname === '/v1/platform/chains') {
    return json({ data: ENABLED_CHAINS })
  }
  return notFoundEnvelope(`route ${url.pathname} not stubbed`)
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`)
  const { statusCode, body } = handle(url)
  response.writeHead(statusCode, { 'content-type': 'application/json' })
  response.end(body)
}).listen(PORT, () => {
  console.log(`stub api listening on :${PORT}`)
})
