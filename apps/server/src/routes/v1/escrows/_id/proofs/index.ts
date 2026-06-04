/**
 * Escrow proof files (ported from the legacy gig proofs route at the #34
 * cutover). The on-chain submit carries only the 32-byte digest — the
 * actual evidence (Cloudinary URLs) lands here:
 *   POST — counterparty adds proofs while accepted (pre-submit upload) or
 *          submitted (poster requested more evidence). Off-chain.
 *   GET  — either party lists them.
 */
import { FastifyPluginAsync } from 'fastify'
import { count, eq } from 'drizzle-orm'
import { escrow_proofs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ApiError, EscrowProof } from '@tenda/shared'
import { loadEscrowOr404, deriveCaller } from '@server/lib/escrow-routes'
import { AppError } from '@server/lib/errors'
import { validateProofs, type ProofInput } from '@server/lib/proofs'

const MAX_TOTAL_PROOFS = 20

const escrowProofs: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { id: string }
    Body: { proofs: ProofInput[] }
    Reply: EscrowProof[] | ApiError
  }>(
    '/',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params
      const { proofs } = request.body ?? {}

      const escrow = await loadEscrowOr404(fastify.db, id)
      if (escrow.status !== 'accepted' && escrow.status !== 'submitted') {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          'Proofs can only be added while the escrow is accepted or submitted',
        )
      }
      if (escrow.counterparty_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the counterparty can add proofs')
      }

      if (!proofs || proofs.length === 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'At least one proof is required')
      }

      // Enforce total proof cap across all submissions.
      const [{ existingCount }] = await fastify.db
        .select({ existingCount: count() })
        .from(escrow_proofs)
        .where(eq(escrow_proofs.escrow_id, id))

      if (existingCount + proofs.length > MAX_TOTAL_PROOFS) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          `Cannot exceed ${MAX_TOTAL_PROOFS} total proofs per escrow (currently have ${existingCount})`,
        )
      }

      validateProofs(proofs, request.user.id)

      const inserted = await fastify.db
        .insert(escrow_proofs)
        .values(
          proofs.map(({ url, type }) => ({
            escrow_id: id,
            url,
            type: type as EscrowProof['type'],
          })),
        )
        .returning()

      // Off-chain action — no verify-tx republish fires, so notify the
      // creator directly through the notifications queue.
      try {
        await fastify.queue.enqueue('notifications', {
          user_id: escrow.creator_id,
          title: 'Additional proof submitted',
          body: 'The worker added more evidence — review and approve.',
          data: { screen: 'escrow', escrowId: id },
        })
      } catch (err) {
        request.log.warn({ err }, 'proofs: notification enqueue failed (queue unavailable)')
      }

      return reply.code(201).send(inserted)
    },
  )

  // GET /v1/escrows/:id/proofs — parties only.
  fastify.get<{
    Params: { id: string }
    Reply: EscrowProof[] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id } = request.params
    const escrow = await loadEscrowOr404(fastify.db, id)
    const caller = deriveCaller({ user_id: request.user.id, role: request.user.role, escrow })
    if (caller === null) {
      throw new AppError(403, ErrorCode.FORBIDDEN, `user has no role on escrow ${id}`)
    }
    return fastify.db.select().from(escrow_proofs).where(eq(escrow_proofs.escrow_id, id))
  })
}

export default escrowProofs
