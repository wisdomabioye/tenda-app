/**
 * POST /v1/auth/set-primary-wallet — switch the primary marker. The
 * partial unique index (`one primary per user`) makes the invariant
 * DB-enforced; the swap runs in one transaction so no window exists with
 * two primaries or none.
 *
 * Body: { chain_ns, address }.
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { chainNamespaceEnum, type ChainNamespace } from '@tenda/shared/db/schema/chains'
import { user_wallets } from '@tenda/shared/db/schema/identity'
import { AppError } from '@server/lib/errors'

interface Body {
  chain_ns?: unknown
  address?: unknown
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const chain_ns = request.body?.chain_ns
      const address = request.body?.address
      if (
        typeof chain_ns !== 'string' ||
        !(chainNamespaceEnum as readonly string[]).includes(chain_ns) ||
        typeof address !== 'string' ||
        address === ''
      ) {
        throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'chain_ns and address are required')
      }
      const ns = chain_ns as ChainNamespace
      const user_id = request.user.id

      await fastify.db.transaction(async (tx) => {
        const target = await tx
          .select({ address: user_wallets.address })
          .from(user_wallets)
          .where(
            and(
              eq(user_wallets.user_id, user_id),
              eq(user_wallets.chain_ns, ns),
              eq(user_wallets.address, address),
            ),
          )
          .limit(1)
        if (target.length === 0) {
          throw new AppError(404, ErrorCode.NOT_FOUND, 'wallet not linked to this account')
        }
        await tx
          .update(user_wallets)
          .set({ is_primary: false })
          .where(and(eq(user_wallets.user_id, user_id), eq(user_wallets.is_primary, true)))
        await tx
          .update(user_wallets)
          .set({ is_primary: true })
          .where(
            and(
              eq(user_wallets.user_id, user_id),
              eq(user_wallets.chain_ns, ns),
              eq(user_wallets.address, address),
            ),
          )
      })
      return { primary: { chain_ns: ns, address } }
    },
  )
}

export default route
