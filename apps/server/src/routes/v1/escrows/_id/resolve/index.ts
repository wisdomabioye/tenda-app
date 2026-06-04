/**
 * POST /v1/escrows/:id/resolve — dispute_admin decides outcome.
 *
 * Body: { winner: 'creator' | 'counterparty' | 'split' }.
 *
 * Authorization: caller must hold the v2 `dispute_admin` role (single key
 * at launch per decision #17; Stage 5 migrates to 2-of-3 multisig with no
 * contract change). State machine: disputed → resolved.
 */

import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { disputes } from '@tenda/shared/db/schema-v2/governance'
import { getPlatformConfig } from '@server/lib/platform'
import { guardTransition } from '@server/lib/escrow-routes'

type Winner = 'creator' | 'counterparty' | 'split'
interface Body { winner: Winner }

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const winner = narrowWinner(request.body?.winner)
      const cfg = await getPlatformConfig(fastify.db)
      const { escrow } = await guardTransition({
        db: fastify.db,
        escrow_id: request.params.id,
        user_id: request.user.id,
        role: request.user.role,
        now: new Date(),
        grace_period_seconds: cfg.grace_period_seconds,
        transition: 'resolve',
      })
      // The on-chain resolve instruction routes the bond by raiser identity;
      // recover it from the dispute record (one row per escrow — unique FK).
      const disputeRows = await fastify.db
        .select({ raised_by: disputes.raised_by })
        .from(disputes)
        .where(eq(disputes.escrow_id, escrow.id))
        .limit(1)
      const dispute = disputeRows[0]
      if (dispute === undefined) {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          `escrow ${escrow.id} has no dispute record to resolve`,
        )
      }
      const adapter = fastify.chains.get(escrow.chain_id)
      const unsigned = await adapter.buildTx({
        action: 'resolveDispute',
        user_id: request.user.id,
        payload: { escrow_id: escrow.id, winner, raiser_user_id: dispute.raised_by },
      })
      return { unsigned }
    },
  )
}

function narrowWinner(v: unknown): Winner {
  // Switch-narrowing without a cast — matches the project rule.
  if (v === 'creator' || v === 'counterparty' || v === 'split') return v
  throw new AppError(
    400,
    ErrorCode.VALIDATION_ERROR,
    `winner must be one of: creator | counterparty | split`,
  )
}

export default route
