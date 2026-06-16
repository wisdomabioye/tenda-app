/**
 * POST /v1/auth/link-wallet — add a second wallet to an authenticated user.
 *
 * Same nonce + signature flow as /wallet, but starts with an authenticated
 * session (the existing user) and signs from the NEW wallet to prove it.
 * The new wallet must not already belong to anyone.
 *
 * Body: { chain_id, address, message, signature }
 *
 * Failure paths:
 *   - 401 UNAUTHORIZED if not authenticated.
 *   - 400 VALIDATION_ERROR for bad body / auth message.
 *   - 401 AUTH_NONCE_{UNKNOWN,REPLAY,EXPIRED} on nonce issues.
 *   - 401 INVALID_SIGNATURE if signature doesn't verify.
 *   - 409 VALIDATION_ERROR if the wallet is already linked (to anyone).
 *
 * Runtime caveat: writes `user_wallets` (v2 schema). Type-correct today;
 * runs end-to-end once #34 cutover migration applies.
 */

import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { user_wallets } from '@tenda/shared/db/schema'
import { users } from '@tenda/shared/db/schema/identity'
import type { ChainNamespace } from '@tenda/shared/db/schema/chains'
import { AppError, requireBody } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { drizzleNonceStore, consumeNonce } from '@server/lib/nonce'
import { assertAuthMessage, parseAuthMessage, expectedAuthUri } from '@server/lib/auth-message'
import { dispatchGasSeeds } from '@server/lib/gas-seed'
import { buildGasSeedDeps } from '@server/lib/onboarding-deps'

interface Body {
  chain_id: string
  address: string
  message: string
  signature: string
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Body }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { chain_id, address, message, signature } = requireBody(request.body)
      requireString('chain_id', chain_id)
      requireString('address', address)
      requireString('message', message)
      requireString('signature', signature)

      const parsed = parseAuthMessage(message)
      assertAuthMessage({
        parsed,
        expected_chain_id: chain_id,
        expected_address: address,
        expected_uri: expectedAuthUri(),
        now: new Date(),
      })

      // Verify signature FIRST — CPU work, no side effect on failure. See
      // wallet/index.ts for the nonce-burn DoS rationale.
      // Reject an unregistered (but well-formed) chain_id with a 400 — without
      // this guard `chains.get` throws a bare Error → 500 on untrusted input
      // (same fix as wallet/index.ts; both nonce+sig routes are symmetric).
      if (!fastify.chains.has(chain_id)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `unsupported chain_id '${chain_id}'`)
      }
      const adapter = fastify.chains.get(chain_id)
      const sigOk = await adapter.verifyAuthSig({ address, message, signature })
      if (!sigOk) {
        throw new AppError(401, ErrorCode.INVALID_SIGNATURE, 'wallet signature did not verify')
      }

      await consumeNonce(drizzleNonceStore(fastify.db), parsed.nonce)

      const chain_ns = deriveChainNs(chain_id)

      // Race-safe insert: rely on the (chain_ns, address) UNIQUE constraint
      // to settle parallel link attempts. `onConflictDoNothing` returns 0
      // rows when the wallet is already linked anywhere; we map that to
      // the existing 409. See open_issues.md S0-2.
      const inserted = await fastify.db
        .insert(user_wallets)
        .values({
          chain_ns,
          address,
          user_id: request.user.id,
          is_primary: false,
        })
        .onConflictDoNothing()
        .returning({ user_id: user_wallets.user_id })

      if (inserted.length === 0) {
        throw new AppError(
          409,
          ErrorCode.VALIDATION_ERROR,
          `wallet ${chain_ns}:${address} is already linked`,
        )
      }

      // Gas-seed check on every successful link (stage-1, decision #16):
      // only phone-verified users are eligible; the dispatcher itself is
      // idempotent per (user, chain). Fire-and-forget — linking must not
      // block on an RPC transfer.
      const [me] = await fastify.db
        .select({ phone_verified_at: users.phone_verified_at })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1)
      if (me?.phone_verified_at != null) {
        void dispatchGasSeeds(buildGasSeedDeps(fastify), request.user.id).catch((err) =>
          fastify.log.warn({ err, user_id: request.user.id }, 'gas seed on link failed'),
        )
      }

      return { ok: true }
    },
  )
}

export default route

function requireString(field: string, value: unknown): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      `${field} is required and must be a non-empty string`,
    )
  }
}

function deriveChainNs(chain_id: string): ChainNamespace {
  const ns = chain_id.split(':')[0]
  if (ns === 'solana' || ns === 'eip155') return ns
  throw new AppError(
    400,
    ErrorCode.VALIDATION_ERROR,
    `chain_id '${chain_id}' has unsupported namespace`,
  )
}
