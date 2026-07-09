/**
 * Escrow proof files (ported from the legacy gig proofs route at the #34
 * cutover). The on-chain submit carries only the 32-byte digest, the
 * actual evidence (Cloudinary URLs) lands here:
 *   POST, counterparty adds proofs while accepted (pre-submit upload) or
 *          submitted (poster requested more evidence). Off-chain.
 *   GET , either party lists them.
 */
import { FastifyPluginAsync } from 'fastify'
import { count, eq } from 'drizzle-orm'
import { escrow_proofs, disputes } from '@tenda/shared/db/schema'
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
      // accepted/submitted = the normal delivery flow; disputed = the worker
      // adds evidence for the mediator while the dispute is open (off-chain,
      // no status change either way).
      const PROOFABLE = ['accepted', 'submitted', 'disputed']
      if (!PROOFABLE.includes(escrow.status)) {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          'Proofs can only be added while the escrow is accepted, submitted, or under dispute',
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

      // Only notify when the escrow is ALREADY submitted, i.e. the on-chain
      // submit confirmed and the poster is reviewing, and the worker is now
      // adding MORE evidence. While `accepted`, this is pre-submit staging:
      // the worker uploads proof, THEN broadcasts the submit tx, which may
      // fail. Notifying here would tell the poster "work is in, review &
      // approve" for a completion that never happened on-chain. The genuine
      // "Work submitted" push rides verify-tx republish (escrow.proof_submitted)
      // once the submit tx confirms, so this path stays silent when accepted.
      if (escrow.status === 'submitted') {
        try {
          await fastify.queue.enqueue('notifications', {
            user_id: escrow.creator_id,
            title: 'Additional proof submitted',
            body: 'The worker added more evidence, review and approve.',
            data: { screen: 'escrow', escrowId: id },
          })
        } catch (err) {
          request.log.warn({ err }, 'proofs: notification enqueue failed (queue unavailable)')
        }
      } else if (escrow.status === 'disputed') {
        // Mid-dispute evidence: alert the other party and the assigned mediator
        // (if any), deep-linking to the shared mediation thread where the proof
        // now shows. Only the counterparty can reach here, so the "other party"
        // is always the creator.
        try {
          const [dispute] = await fastify.db
            .select({ assigned_to: disputes.assigned_to })
            .from(disputes)
            .where(eq(disputes.escrow_id, id))
          const recipients = new Set<string>([escrow.creator_id])
          if (dispute?.assigned_to) recipients.add(dispute.assigned_to)
          for (const user_id of recipients) {
            await fastify.queue.enqueue('notifications', {
              user_id,
              title: 'New dispute evidence',
              body: 'The worker added evidence to the dispute.',
              data: { screen: 'dispute', escrowId: id },
            })
          }
        } catch (err) {
          request.log.warn({ err }, 'proofs: dispute notification enqueue failed (queue unavailable)')
        }
      }

      return reply.code(201).send(inserted)
    },
  )

  // GET /v1/escrows/:id/proofs, parties only.
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
