/**
 * POST /v1/auth/unlink-wallet — remove a linked wallet. Thin wrapper: validates
 * the body, then delegates to `unlinkWallet` (lib/auth/wallet-unlink) which owns
 * the atomic load → guard → delete under a per-user advisory lock. Guards:
 *   1. cannot remove your LAST sign-in method (identities ∪ wallets) — Stage 9D
 *      credential model: a wallet-only account can't drop its wallet, but an
 *      account that still has a verified email/phone CAN (it logs back in by
 *      contact and re-links a wallet at the next transaction) → 409
 *      LAST_CREDENTIAL.
 *   2. cannot unlink the primary while ANOTHER wallet exists → 409 WALLET_IN_USE.
 *   3. cannot unlink a wallet that is a party to an active escrow on its
 *      namespace → 409 WALLET_IN_USE with the affected escrow ids.
 *
 * Body: { chain_ns, address }.
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { chainNamespaceEnum, type ChainNamespace } from '@tenda/shared/db/schema/chains'
import { AppError } from '@server/lib/errors'
import { unlinkWallet } from '@server/lib/auth/wallet-unlink'

interface Body {
  chain_ns?: unknown
  address?: unknown
}

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

      await unlinkWallet(fastify.db, { userId: request.user.id, chain_ns, address })
      return { unlinked: true }
    },
  )
}

export default route
