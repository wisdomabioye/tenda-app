/**
 * POST /v1/auth/wallet — verify wallet signature, upsert user, return JWT.
 *
 * Legacy shim (Stage 9): the unified surface is POST /v1/auth/verify
 * { method: 'wallet' }, which is LOGIN-ONLY (find-or-reject). This route
 * keeps the historical find-or-CREATE behaviour so the current mobile client
 * — whose only sign-up path is wallet — keeps working until Stage 9C ships
 * the multi-method onboarding; it is removed then.
 *
 * The verify-message-and-signature flow + JWT minting are shared with the
 * unified route via lib/auth (no duplicated nonce/sig/JWT logic).
 *
 * Body: { chain_id, address, message, signature, is_seeker?, country? }
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { users, user_wallets } from '@tenda/shared/db/schema'
import type { ChainNamespace } from '@tenda/shared/db/schema'
import { AppError, requireBody, requireNonEmptyString } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { verifyWalletAuth } from '@server/lib/auth/strategies/wallet'
import { mintAuthResponse } from '@server/lib/auth/session'
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
        requireBody(request.body)
      requireNonEmptyString(chain_id, 'chain_id')
      requireNonEmptyString(address, 'address')
      requireNonEmptyString(message, 'message')
      requireNonEmptyString(signature, 'signature')

      const { chain_ns } = await verifyWalletAuth(
        { chains: fastify.chains, db: fastify.db, now: () => new Date() },
        { chain_id, address, message, signature },
      )

      const user = await findOrCreateUserByWallet(fastify.db, { chain_ns, address, is_seeker, country })
      return mintAuthResponse(fastify, user)
    },
  )
}

export default route

// ---------- helpers ------------------------------------------------------

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
      and(eq(user_wallets.chain_ns, args.chain_ns), eq(user_wallets.address, args.address)),
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

  // New wallet → create user + primary wallet atomically. `onConflictDoNothing`
  // on user_wallets handles the race where a parallel request inserted the
  // same wallet between our SELECT and INSERT — we then re-resolve the user
  // via the row that won the race instead of bubbling the UNIQUE-violation 500.
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ is_seeker: args.is_seeker, country: args.country })
      .returning()
    if (created === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'user insert returned no row')
    }
    const inserted = await tx
      .insert(user_wallets)
      .values({
        chain_ns: args.chain_ns,
        address: args.address,
        user_id: created.id,
        is_primary: true,
      })
      .onConflictDoNothing()
      .returning({ user_id: user_wallets.user_id })

    if (inserted.length > 0) return created

    // Wallet race lost — delete our orphan user (net-zero) and re-load the
    // user attached to the winning wallet row.
    await tx.delete(users).where(eq(users.id, created.id))
    const winner = await tx
      .select({ user_id: user_wallets.user_id })
      .from(user_wallets)
      .where(
        and(eq(user_wallets.chain_ns, args.chain_ns), eq(user_wallets.address, args.address)),
      )
      .limit(1)
    const winnerRow = winner[0]
    if (winnerRow === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'wallet race winner not found')
    }
    const [winnerUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, winnerRow.user_id))
      .limit(1)
    if (winnerUser === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'race winner has no user row')
    }
    return winnerUser
  })
}
