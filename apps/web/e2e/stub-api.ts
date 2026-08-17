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
import {
  deliveryGig,
  deliveryGigDetail,
  E2E_FAIL_GIG_ID,
  E2E_FAIL_QUERY,
  photoGig,
  unbreakableGig,
  unbreakableGigDetail,
} from './fixtures/gigs'
import { createAuthWorld, E2E_OTP_CODE, signIn, toMeUser, userForBearer } from './fixtures/auth'
import { createChatWorld, handleChat, resetChatWorld } from './fixtures/chat'
import { createNotificationsWorld, handleNotifications, resetNotificationsWorld } from './fixtures/notifications'

const PORT = Number(process.env.STUB_API_PORT ?? 3210)
// `unbreakableGig` carries poster-written text at its nastiest (a pasted
// link in the title, the longest real place name). It rides in the FEED so
// the layout checks see it without a special route — see fixtures/gigs.ts.
const GIGS: GigSummary[] = [deliveryGig, photoGig, unbreakableGig]
const world = createAuthWorld()
const chatWorld = createChatWorld()
const notificationsWorld = createNotificationsWorld()

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
  // Detail flow (S4.4): the bearer read of the SAME endpoint the public page
  // SSRs anonymously — a signed-in reader gets the party-scoped half. The
  // signed-in e2e user is cast as the CREATOR, so the CTA bar offers the
  // poster's moves.
  {
    const detail = url.pathname.match(/^\/v1\/gigs\/([^/]+)$/)
    if (detail !== null && method === 'GET' && authorization !== undefined) {
      const user = userForBearer(world, authorization)
      if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
      const id = detail[1]
      if (id === deliveryGigDetail.escrow_id) {
        return json({
          ...deliveryGigDetail,
          creator: { ...deliveryGigDetail.creator, id: user.id },
          // The party-scoped detail carries no stranger's identity here.
          assigned_counterparty_id: null,
          counterparty: null,
          is_assigned: false,
        })
      }
      if (id === 'new-gig-1') {
        // The draft the creation e2e leaves behind after a failed signature.
        return json({
          ...deliveryGigDetail,
          escrow_id: 'new-gig-1',
          title: 'Deliver a package to Victoria Island',
          status: 'draft',
          creator: { ...deliveryGigDetail.creator, id: user.id },
          assigned_counterparty_id: null,
          counterparty: null,
          is_assigned: false,
        })
      }
      if (id === 'hidden-party-gig') {
        return json({
          ...deliveryGigDetail,
          escrow_id: 'hidden-party-gig',
          hidden: true,
          creator: { ...deliveryGigDetail.creator, id: user.id },
          assigned_counterparty_id: null,
          counterparty: null,
          is_assigned: false,
        })
      }
      // Fall through to the public handler's 404 for anything else.
    }
  }
  // Transition builders (S4.4): every /v1/escrows/:id/<action> answers with
  // an unsigned tx; the e2e build has no wallet runtime, so flows stop at
  // the typed no-wallet error AFTER the server leg — which is the ordering
  // under test.
  {
    const transition = url.pathname.match(
      /^\/v1\/escrows\/([^/]+)\/(accept|decline|cancel|approve|claim|refund|submit|unassign|assign|build-create)$/,
    )
    if (transition !== null && method === 'POST') {
      const user = userForBearer(world, authorization)
      if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
      return json({
        unsigned: { kind: 'solana-tx', tx_base64: 'AQID', recent_blockhash: 'hash', last_valid_block_height: 1 },
      })
    }
  }
  // Creation flow (S4.1): the wizard's server legs. The e2e build has NO
  // wallet runtime, so the flow ends at the signing step — the draft
  // survives and the screen lands on the gig page, which is exactly the
  // declined-signing contract under test.
  if (url.pathname === '/v1/moderation/preview' && method === 'POST') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    return json({ decision: 'approve', reasons: [] })
  }
  if (url.pathname === '/v1/escrows' && method === 'POST') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const create = JSON.parse(body) as { kind: string; chain_id: string; amount_raw: string }
    if (create.kind !== 'gig') return errorEnvelope(400, 'Bad Request', 'unsupported kind', 'VALIDATION_ERROR')
    return json({
      escrow_id: 'new-gig-1',
      unsigned: { kind: 'solana-tx', tx_base64: 'AQID', recent_blockhash: 'hash', last_valid_block_height: 1 },
    })
  }
  if (url.pathname === '/v1/gigs' && method === 'POST') {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const details = JSON.parse(body) as { escrow_id: string; title: string }
    return json({ escrow_id: details.escrow_id, title: details.title, status: 'draft' })
  }
  // Test-control route (no auth, stub-only): restores the chat world so CI
  // retries and repeat runs start from the seeded state.
  if (url.pathname === '/__e2e/reset-chat' && method === 'POST') {
    resetChatWorld(chatWorld)
    return json({ ok: true })
  }
  if (url.pathname === '/__e2e/reset-notifications' && method === 'POST') {
    resetNotificationsWorld(notificationsWorld)
    return json({ ok: true })
  }
  // Notification centre (S5.3), auth-gated like the real routes.
  if (url.pathname.startsWith('/v1/notifications')) {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const handled = handleNotifications(notificationsWorld, url, method)
    if (handled !== null) return json(handled.payload, handled.statusCode)
  }
  // Chat (S5.2): conversations + messages, auth-gated like the real routes.
  if (url.pathname.startsWith('/v1/conversations') || /^\/v1\/users\/[^/]+$/.test(url.pathname)) {
    const user = userForBearer(world, authorization)
    if (user === null) return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
    const chat = handleChat(chatWorld, url, method, user.id, body)
    if (chat !== null) return json(chat.payload, chat.statusCode)
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
