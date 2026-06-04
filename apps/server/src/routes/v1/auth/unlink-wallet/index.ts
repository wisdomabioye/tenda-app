/**
 * POST /v1/auth/unlink-wallet — remove a linked wallet. Three guards
 * (stage-1-onboarding.md):
 *   1. cannot unlink the sole wallet on the account
 *   2. cannot unlink the primary unless another wallet exists
 *   3. cannot unlink a wallet that is a party to any escrow in
 *      {open, accepted, submitted, disputed} on its namespace —
 *      409 WALLET_IN_USE with the affected escrow ids (the user must not
 *      lose signing ability mid-flow).
 *
 * Body: { chain_ns, address }.
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq, inArray, or } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { chainNamespaceEnum, chains, type ChainNamespace } from '@tenda/shared/db/schema-v2/chains'
import { escrows } from '@tenda/shared/db/schema-v2/escrow'
import { user_wallets } from '@tenda/shared/db/schema-v2/identity'
import { AppError } from '@server/lib/errors'

interface Body {
  chain_ns?: unknown
  address?: unknown
}

const ACTIVE_STATUSES = ['open', 'accepted', 'submitted', 'disputed'] as const

function narrowNamespace(v: unknown): ChainNamespace {
  if (typeof v === 'string' && (chainNamespaceEnum as readonly string[]).includes(v)) {
    return v as ChainNamespace
  }
  throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'chain_ns must be solana | eip155')
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const chain_ns = narrowNamespace(request.body?.chain_ns)
      const address = request.body?.address
      if (typeof address !== 'string' || address === '') {
        throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'address is required')
      }
      const user_id = request.user.id

      const wallets = await fastify.db
        .select({
          chain_ns: user_wallets.chain_ns,
          address: user_wallets.address,
          is_primary: user_wallets.is_primary,
        })
        .from(user_wallets)
        .where(eq(user_wallets.user_id, user_id))

      const target = wallets.find((w) => w.chain_ns === chain_ns && w.address === address)
      if (target === undefined) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'wallet not linked to this account')
      }
      if (wallets.length === 1) {
        throw new AppError(409, ErrorCode.WALLET_IN_USE, 'cannot unlink the only wallet')
      }
      if (target.is_primary) {
        throw new AppError(
          409,
          ErrorCode.WALLET_IN_USE,
          'set another wallet as primary before unlinking this one',
        )
      }

      // Guard 3: active escrows on this namespace bind this wallet's
      // signing ability — block until they reach a terminal state.
      const active = await fastify.db
        .select({ id: escrows.id })
        .from(escrows)
        .innerJoin(chains, eq(escrows.chain_id, chains.id))
        .where(
          and(
            eq(chains.namespace, chain_ns),
            inArray(escrows.status, [...ACTIVE_STATUSES]),
            or(eq(escrows.creator_id, user_id), eq(escrows.counterparty_id, user_id)),
          ),
        )
      if (active.length > 0) {
        throw new AppError(409, ErrorCode.WALLET_IN_USE, 'wallet is a party to active escrows', {
          escrow_ids: active.map((e) => e.id),
        })
      }

      await fastify.db
        .delete(user_wallets)
        .where(
          and(
            eq(user_wallets.user_id, user_id),
            eq(user_wallets.chain_ns, chain_ns),
            eq(user_wallets.address, address),
          ),
        )
      return { unlinked: true }
    },
  )
}

export default route
