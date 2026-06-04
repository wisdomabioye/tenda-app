/**
 * POST /v1/escrows — the create entry for the escrow primitive.
 *
 * Flow: validate (lib/escrow-create.ts) → generate the id server-side →
 * build the unsigned createEscrow tx (the DB id is the on-chain PDA seed)
 * → insert the draft row. Tx is built BEFORE the insert so a builder
 * failure never strands an orphan draft; the insert is the last step and
 * the unsigned tx is only returned when the row exists.
 *
 * Domain satellites (gig_details / exchange_details) are attached by the
 * kind-specific create routes (cutover §3 — "gigs/: listings +
 * create-detail only"); this route owns the chain-agnostic core.
 *
 * is_seeker comes from the DB user row, never the request body — it
 * selects the fee tier and must not be client-claimed.
 */

import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { escrows } from '@tenda/shared/db/schema'
import { users } from '@tenda/shared/db/schema/identity'
import { AppError } from '@server/lib/errors'
import { requireGoodStanding } from '@server/features/reputation/guards'
import { requireProfileComplete } from '@server/lib/guards'
import { validateCreateEscrow, type CreateEscrowBody } from '@server/lib/escrow-create'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateEscrowBody }>(
    '/',
    { preHandler: [fastify.authenticate, requireProfileComplete, requireGoodStanding('create')] },
    async (request, reply) => {
      const input = validateCreateEscrow(
        {
          hasChain: (chain_id) => fastify.chains.has(chain_id),
          now: () => new Date(),
          caller_user_id: request.user.id,
        },
        request.body ?? {},
      )

      const userRows = await fastify.db
        .select({ is_seeker: users.is_seeker })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1)
      const user = userRows[0]
      if (user === undefined) {
        throw new AppError(401, ErrorCode.UNAUTHORIZED, 'user no longer exists')
      }

      const escrow_id = randomUUID()
      const adapter = fastify.chains.get(input.chain_id)
      const unsigned = await adapter.buildTx({
        action: 'createEscrow',
        user_id: request.user.id,
        payload: {
          escrow_id,
          kind: input.kind,
          asset: input.asset,
          amount_raw: input.amount_raw,
          ...(input.assigned_counterparty_id !== null
            ? { assigned_counterparty_user_id: input.assigned_counterparty_id }
            : {}),
          accept_deadline_unix: input.accept_deadline_unix,
          completion_duration_seconds: input.completion_duration_seconds,
          dispute_bond_raw: input.dispute_bond_raw,
          is_seeker: user.is_seeker,
        },
      })

      await fastify.db.insert(escrows).values({
        id: escrow_id,
        kind: input.kind,
        chain_id: input.chain_id,
        asset: input.asset,
        amount_raw: input.amount_raw,
        creator_id: request.user.id,
        assigned_counterparty_id: input.assigned_counterparty_id,
        status: 'draft',
        accept_deadline: new Date(input.accept_deadline_unix * 1000),
        completion_duration_seconds: input.completion_duration_seconds,
        dispute_bond_raw: input.dispute_bond_raw,
        is_seeker: user.is_seeker,
      })

      return reply.code(201).send({ escrow_id, unsigned })
    },
  )
}

export default route
