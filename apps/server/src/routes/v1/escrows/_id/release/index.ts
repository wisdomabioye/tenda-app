/**
 * POST /v1/escrows/:id/release — the assigned worker says they are not
 * available.
 *
 * OFF-CHAIN by design. In approval mode the worker signed nothing to be
 * assigned, so requiring a signature to step back would make the honest move
 * the expensive one. This records the signal, which does three things:
 *
 *  - suppresses the abandonment strike (features/reputation/signals),
 *  - frees the worker's capacity slot immediately (features/capacity/store),
 *  - notifies the poster, whose `unassign` is what actually moves the escrow.
 *
 * Idempotent: releasing twice returns the first stamp rather than moving it,
 * so a double-tap cannot quietly extend anything.
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { escrows } from '@tenda/shared/db/schema'
import { ErrorCode, type ReleaseAssignmentResponse } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { loadEscrowOr404 } from '@server/lib/escrow-routes'
import { appEvents } from '@server/lib/events'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request): Promise<ReleaseAssignmentResponse> => {
      const escrow = await loadEscrowOr404(fastify.db, request.params.id)

      if (escrow.counterparty_id !== request.user.id) {
        // A DIRECT-INVITE worker who has not accepted yet is a real caller
        // here: they are named on `assigned_counterparty_id`, but
        // `counterparty_id` stays null until they sign. Telling them "only the
        // assigned worker can release this" would be plainly false — and it
        // would hide the fact that they already have a way out.
        if (escrow.assigned_counterparty_id === request.user.id) {
          throw new AppError(
            409,
            ErrorCode.ESCROW_WRONG_STATUS,
            'You have not accepted this gig yet — decline the invitation instead.',
          )
        }
        throw new AppError(
          403,
          ErrorCode.ESCROW_WRONG_CALLER,
          'Only the assigned worker can release this gig',
        )
      }
      if (escrow.status !== 'accepted') {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          `cannot release from status '${escrow.status}'`,
        )
      }
      // Only approval-mode assignments: a worker who accepted for themselves
      // committed on-chain, and stepping back from that is `dispute` or
      // letting the deadline pass — not a one-tap release.
      if (!escrow.requires_approval) {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          'You accepted this gig yourself; release applies only to assigned work',
        )
      }
      if (escrow.assignment_released_at !== null) {
        return { released_at: escrow.assignment_released_at.toISOString() }
      }

      const released_at = new Date()
      // Guarded on still-null so two concurrent taps settle on one stamp.
      const [updated] = await fastify.db
        .update(escrows)
        .set({ assignment_released_at: released_at })
        .where(and(eq(escrows.id, escrow.id), isNull(escrows.assignment_released_at)))
        .returning({ assignment_released_at: escrows.assignment_released_at })

      const stamped = updated?.assignment_released_at ?? released_at
      appEvents.emit('escrow.assignment_released_offchain', {
        escrow_id: escrow.id,
        creator_id: escrow.creator_id,
        worker_id: request.user.id,
      })
      return { released_at: stamped.toISOString() }
    },
  )
}

export default route
