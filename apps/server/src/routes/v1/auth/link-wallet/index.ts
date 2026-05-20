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
import { and, eq } from 'drizzle-orm'
import { user_wallets } from '@tenda/shared/db/schema-v2'
import type { ChainNamespace } from '@tenda/shared/db/schema-v2/chains'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { drizzleNonceStore, consumeNonce } from '@server/lib/nonce'
import { assertAuthMessage, parseAuthMessage } from '@server/lib/auth-message'

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
      const { chain_id, address, message, signature } = request.body
      requireString('chain_id', chain_id)
      requireString('address', address)
      requireString('message', message)
      requireString('signature', signature)

      const parsed = parseAuthMessage(message)
      assertAuthMessage({
        parsed,
        expected_chain_id: chain_id,
        expected_address: address,
        now: new Date(),
      })

      // Verify signature FIRST — CPU work, no side effect on failure. See
      // wallet/index.ts for the nonce-burn DoS rationale.
      const adapter = fastify.chains.get(chain_id)
      const sigOk = await adapter.verifyAuthSig({ address, message, signature })
      if (!sigOk) {
        throw new AppError(401, ErrorCode.INVALID_SIGNATURE, 'wallet signature did not verify')
      }

      await consumeNonce(drizzleNonceStore(fastify.db), parsed.nonce)

      const chain_ns = deriveChainNs(chain_id)

      // The wallet must not already be linked anywhere.
      const existing = await fastify.db
        .select({ user_id: user_wallets.user_id })
        .from(user_wallets)
        .where(
          and(
            eq(user_wallets.chain_ns, chain_ns),
            eq(user_wallets.address, address),
          ),
        )
        .limit(1)
      if (existing.length > 0) {
        throw new AppError(
          409,
          ErrorCode.VALIDATION_ERROR,
          `wallet ${chain_ns}:${address} is already linked`,
        )
      }

      await fastify.db.insert(user_wallets).values({
        chain_ns,
        address,
        user_id: request.user.id,
        is_primary: false,
      })

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
