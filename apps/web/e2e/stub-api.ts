/**
 * Deterministic Fastify stand-in for e2e. The Next SERVER fetches the public
 * routes during SSR and the BROWSER calls the authed ones (page.route can't
 * intercept server-side fetches, which is why admin's client-mock pattern
 * doesn't work here). Plain node http — no dependencies, boots in
 * milliseconds under Playwright's webServer.
 */
import { createServer, type IncomingMessage } from 'node:http'
import type {
  ChainRegistryEntry,
  ChallengeBody,
  GigSummary,
  MeResponse,
  PaginatedResponse,
  UpdateMeInput,
  UserEscrowTransaction,
  UserTransactionsSummary,
  VerifyBody,
} from '@tenda/shared'
import { hasCompleteName } from '@tenda/shared'
import { deliveryGig, deliveryGigDetail, photoGig } from './fixtures/gigs'
import { createAuthWorld, E2E_OTP_CODE, signIn, toMeUser, userForBearer } from './fixtures/auth'

const PORT = Number(process.env.STUB_API_PORT ?? 3210)
const GIGS: GigSummary[] = [deliveryGig, photoGig]
const world = createAuthWorld()

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

interface StubResponse {
  statusCode: number
  body: string
}

function json(body: unknown, statusCode = 200): StubResponse {
  return { statusCode, body: JSON.stringify(body) }
}

function errorEnvelope(statusCode: number, error: string, message: string, code: string): StubResponse {
  return json({ statusCode, error, message, code }, statusCode)
}

function notFoundEnvelope(message: string): StubResponse {
  return errorEnvelope(404, 'Not Found', message, 'NOT_FOUND')
}

function handlePublic(url: URL): StubResponse | null {
  if (url.pathname === '/v1/gigs') {
    const category = url.searchParams.get('category')
    const remote = url.searchParams.get('remote')
    const q = url.searchParams.get('q')?.toLowerCase()
    let data = GIGS
    if (category !== null) data = data.filter((gig) => gig.category === category)
    if (remote === 'true') data = data.filter((gig) => gig.remote)
    if (q !== undefined) data = data.filter((gig) => gig.title.toLowerCase().includes(q))
    const page: PaginatedResponse<GigSummary> = { data, total: data.length, limit: 20, offset: 0, next_cursor: null }
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
  return null
}

function handleAuth(url: URL, method: string, authorization: string | undefined, body: string): StubResponse | null {
  if (url.pathname === '/v1/auth/challenge' && method === 'POST') {
    const challenge = JSON.parse(body) as ChallengeBody
    if (challenge.identifier === '') return errorEnvelope(400, 'Bad Request', 'identifier required', 'VALIDATION_ERROR')
    return json({ expires_in: 600 })
  }
  if (url.pathname === '/v1/auth/verify' && method === 'POST') {
    const verify = JSON.parse(body) as VerifyBody
    if (verify.code !== E2E_OTP_CODE) {
      return errorEnvelope(401, 'Unauthorized', 'Invalid or expired code', 'OTP_INVALID')
    }
    return json(signIn(world, verify.identifier ?? ''))
  }
  if (url.pathname === '/v1/auth/me' && method === 'GET') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    return json(user)
  }
  if (url.pathname === '/v1/auth/methods' && method === 'GET') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    return json({ identities: [{ kind: 'email', identifier: 'ada@tenda.test', email: 'ada@tenda.test', verified: true }] })
  }
  if (url.pathname === '/v1/users/me' && method === 'GET') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const me: MeResponse = {
      user: toMeUser(user),
      wallets: [
        { chain_ns: 'solana', address: 'SoLPrimaryAddr1111111111111111111111111111', is_primary: true, verified_at: '2026-08-01T00:00:00Z' },
        { chain_ns: 'eip155', address: '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01', is_primary: false, verified_at: '2026-08-02T00:00:00Z' },
      ],
      profile_complete: hasCompleteName(user.first_name, user.last_name),
    }
    return json(me)
  }
  // Wallet screen (S3.5): lifetime totals are a server aggregate; the feed is
  // one page with a payout row credited to the signed-in worker.
  if (/^\/v1\/users\/[^/]+\/transactions\/summary$/.test(url.pathname) && method === 'GET') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    // Typed against the wire so the stub cannot drift from the contract.
    const summary: UserTransactionsSummary = {
      earned_raw: '80000000',
      spent_raw: '30000000',
      asset: 'USDC_SOL',
    }
    return json(summary)
  }
  if (/^\/v1\/users\/[^/]+\/transactions$/.test(url.pathname) && method === 'GET') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const page: PaginatedResponse<UserEscrowTransaction> = {
      data: [
        {
          id: 'tx-1',
          escrow_id: 'esc-1',
          type: 'approve',
          tx_ref: 'sig-1',
          amount_raw: '48500000',
          platform_fee_raw: '1500000',
          creator_payout_raw: null,
          actor_id: 'someone-else',
          winner: null,
          created_at: '2026-08-14T10:00:00Z',
          escrow: {
            id: 'esc-1',
            kind: 'gig',
            title: 'Deliver documents downtown',
            amount_raw: '50000000',
            asset: 'USDC_SOL',
            chain_id: 'solana:devnet',
            status: 'completed',
            creator_id: 'someone-else',
            counterparty_id: user.id,
          },
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }
    return json(page)
  }
  if (url.pathname === '/v1/users/me' && method === 'PATCH') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const input = JSON.parse(body) as UpdateMeInput
    if (input.first_name !== undefined) user.first_name = input.first_name
    if (input.last_name !== undefined) user.last_name = input.last_name
    // is_seeker is NOT patchable (Seeker device fee tier, signup-bootstrap
    // only) — the real route ignores it, so the stub accepts nothing either.
    return json({
      user: toMeUser(user),
      profile_complete: hasCompleteName(user.first_name, user.last_name),
    })
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
      handleAuth(url, method, request.headers.authorization, body) ??
      handlePublic(url) ??
      notFoundEnvelope(`route ${method} ${url.pathname} not stubbed`)
    response.writeHead(result.statusCode, { 'content-type': 'application/json', ...CORS_HEADERS })
    response.end(result.body)
  })()
}).listen(PORT, () => {
  console.log(`stub api listening on :${PORT}`)
})
