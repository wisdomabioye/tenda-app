/**
 * POST /v1/escrows/:id/dispute — either party raises a dispute.
 *
 * Body: { bond_raw, reason } — dispute bond paid by the raiser; refunded
 * on win, forfeited on loss. Amount validated against platform_config at
 * the contract layer; server passes through.
 *
 * The disputes triage row (reason + raiser) is upserted HERE at request
 * time — the on-chain DisputeRaised event only flips escrow.status, and
 * recordDisputeResolution later stamps the winner onto this row. Re-raising
 * after a failed broadcast refreshes the reason instead of erroring
 * (disputes.escrow_id is UNIQUE).
 *
 * State machine: accepted | submitted → disputed.
 */

import type { FastifyPluginAsync } from 'fastify'
import { disputes } from '@tenda/shared/db/schema'
import { AppError } from '@server/lib/errors'
import { requireGoodStanding } from '@server/features/reputation/guards'
import { ErrorCode, EXCHANGE_DISPUTE_REASON_MIN_LENGTH, EXCHANGE_DISPUTE_REASON_MAX_LENGTH } from '@tenda/shared'
import { getPlatformConfig } from '@server/lib/platform'
import { guardTransition } from '@server/lib/escrow-routes'
import { isAmountRaw } from '@server/chains/types'

interface Body {
  bond_raw: string
  reason: string
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate, requireGoodStanding('dispute')] },
    async (request) => {
      const { bond_raw, reason } = request.body
      if (!isAmountRaw(bond_raw)) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'bond_raw required (canonical decimal integer string)',
        )
      }
      const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
      if (
        trimmedReason.length < EXCHANGE_DISPUTE_REASON_MIN_LENGTH ||
        trimmedReason.length > EXCHANGE_DISPUTE_REASON_MAX_LENGTH
      ) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          `reason must be ${EXCHANGE_DISPUTE_REASON_MIN_LENGTH}–${EXCHANGE_DISPUTE_REASON_MAX_LENGTH} characters`,
        )
      }
      const cfg = await getPlatformConfig(fastify.db)
      const { escrow } = await guardTransition({
        db: fastify.db,
        escrow_id: request.params.id,
        user_id: request.user.id,
        role: request.user.role,
        now: new Date(),
        grace_period_seconds: cfg.grace_period_seconds,
        transition: 'dispute',
      })

      // Triage row for the admin queue. Upsert: a retry after a failed
      // broadcast refreshes the reason rather than 409ing.
      await fastify.db
        .insert(disputes)
        .values({ escrow_id: escrow.id, raised_by: request.user.id, reason: trimmedReason })
        .onConflictDoUpdate({
          target: disputes.escrow_id,
          set: { raised_by: request.user.id, reason: trimmedReason },
        })

      const adapter = fastify.chains.get(escrow.chain_id)
      const unsigned = await adapter.buildTx({
        action: 'disputeEscrow',
        user_id: request.user.id,
        payload: { escrow_id: escrow.id, bond_raw },
      })
      return { unsigned }
    },
  )
}

export default route
