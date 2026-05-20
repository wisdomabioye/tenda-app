/**
 * POST /v1/auth/wallet — verify wallet signature, upsert user, return JWT.
 *
 * Replaces the legacy timestamp-based auth flow. New design (per
 * stage-0-foundation.md L364-366 + stage-1-onboarding.md L252-263):
 *
 *   1. Parse the auth-message header (Chain, Nonce, Issued At, address).
 *   2. Validate: chain matches request, address matches request, age ±60s.
 *   3. Resolve the chain adapter and verify the signature via tweetnacl
 *      (Solana) or viem (EVM, Stage 3+). Sig check runs BEFORE nonce
 *      consumption — otherwise any attacker who observes a nonce could
 *      burn it with a garbage signature (DoS).
 *   4. Consume the server-issued nonce (single-use, 5-min TTL).
 *   5. Look up `user_wallets(chain_ns, address)`. If found, load the user;
 *      if not, create user + primary wallet rows in one transaction.
 *   6. Mint a JWT.
 *
 * Body shape:
 *   { chain_id, address, message, signature, is_seeker?, country? }
 *
 * Failure paths:
 *   - 400 VALIDATION_ERROR for malformed body or auth message.
 *   - 401 INVALID_SIGNATURE if the wallet-sig check fails.
 *   - 401 AUTH_NONCE_{UNKNOWN,EXPIRED} / 409 AUTH_NONCE_REPLAY for nonce issues.
 *   - 403 USER_SUSPENDED if the user account is suspended.
 *
 * Runtime caveat: writes against the v2 schema (`users`, `user_wallets`),
 * which is migrated at #34 cutover. Type-correct today; runs end-to-end
 * once cutover applies the schema.
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { users, user_wallets } from '@tenda/shared/db/schema-v2'
import type { ChainNamespace } from '@tenda/shared/db/schema-v2/chains'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { drizzleNonceStore, consumeNonce } from '@server/lib/nonce'
import { assertAuthMessage, parseAuthMessage } from '@server/lib/auth-message'
import { getConfig } from '@server/config'
import type { AppDatabase } from '@server/plugins/db'

interface Body {
  chain_id: string
  address: string
  message: string
  signature: string
  is_seeker?: boolean
  country?: string | null
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Body }>(
    '/',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { chain_id, address, message, signature, is_seeker = false, country = null } =
        request.body

      requireString('chain_id', chain_id)
      requireString('address', address)
      requireString('message', message)
      requireString('signature', signature)

      // 1-2. Parse + validate header (chain, address, age).
      const parsed = parseAuthMessage(message)
      assertAuthMessage({
        parsed,
        expected_chain_id: chain_id,
        expected_address: address,
        now: new Date(),
      })

      // 3. Verify signature FIRST — CPU work, no side effect on failure.
      // Consuming the nonce before sig check would let any attacker burn
      // any observed nonce by submitting a garbage signature.
      const adapter = fastify.chains.get(chain_id)
      const sigOk = await adapter.verifyAuthSig({ address, message, signature })
      if (!sigOk) {
        throw new AppError(401, ErrorCode.INVALID_SIGNATURE, 'wallet signature did not verify')
      }

      // 4. Consume nonce — throws AUTH_NONCE_{UNKNOWN,REPLAY,EXPIRED}.
      // Single-use: if a legitimate signature reaches this line, the nonce
      // is spent; replays of the same (message, signature) fail at step 4.
      await consumeNonce(drizzleNonceStore(fastify.db), parsed.nonce)

      // 5. Find-or-create user via user_wallets lookup.
      const chain_ns = deriveChainNs(chain_id)
      const user = await findOrCreateUserByWallet(fastify.db, {
        chain_ns,
        address,
        is_seeker,
        country,
      })

      if (user.status === 'suspended') {
        throw new AppError(403, ErrorCode.USER_SUSPENDED, 'account suspended')
      }

      // 6. Mint JWT. `wallet_address` holds whatever-chain-just-authed and
      // is preserved for legacy-route compatibility until #34 cutover
      // deletes those routes. Post-cutover, EVM auth would put a 0x-address
      // here that legacy Solana-only handlers couldn't decode — but those
      // handlers are scheduled for deletion at the same point. Do NOT read
      // this field from any new code.
      const token = fastify.jwt.sign(
        {
          id: user.id,
          wallet_address: address,
          role: user.role,
          is_seeker: user.is_seeker,
          country: user.country ?? null,
        },
        { expiresIn: getConfig().JWT_EXPIRES_IN },
      )

      return { token, user }
    },
  )
}

export default route

// ---------- helpers ------------------------------------------------------

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

async function findOrCreateUserByWallet(
  db: AppDatabase,
  args: {
    chain_ns: ChainNamespace
    address: string
    is_seeker: boolean
    country: string | null
  },
): Promise<typeof users.$inferSelect> {
  // Existing wallet → existing user.
  const existing = await db
    .select({ user_id: user_wallets.user_id })
    .from(user_wallets)
    .where(
      and(
        eq(user_wallets.chain_ns, args.chain_ns),
        eq(user_wallets.address, args.address),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    const row = existing[0]
    if (row === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'wallet lookup row missing')
    }
    const [user] = await db.select().from(users).where(eq(users.id, row.user_id)).limit(1)
    if (user === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'wallet has no user row')
    }
    return user
  }

  // New wallet → create user + primary wallet atomically.
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ is_seeker: args.is_seeker, country: args.country })
      .returning()
    if (created === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'user insert returned no row')
    }
    await tx.insert(user_wallets).values({
      chain_ns: args.chain_ns,
      address: args.address,
      user_id: created.id,
      is_primary: true,
    })
    return created
  })
}
