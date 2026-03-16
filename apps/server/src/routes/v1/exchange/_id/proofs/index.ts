import { FastifyPluginAsync } from 'fastify'
import { and, count, eq } from 'drizzle-orm'
import { exchange_proofs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { ensureOfferExists, ensureOfferOwnership, ensureOfferStatus, buildOfferDetail } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import { validateProofs } from '@server/lib/proofs'

type AddProofsRoute = ExchangeContract['addProofs']

const MAX_TOTAL_PROOFS = 20

const exchangeAddProofs: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/proofs — buyer adds supplementary proof after marking as paid.
  // No on-chain transaction required: escrow is already in paid state.
  // Allows the buyer to provide more evidence if the seller requests it.
  fastify.post<{
    Params: AddProofsRoute['params']
    Body: AddProofsRoute['body']
    Reply: AddProofsRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { proofs } = request.body

      if (!proofs || proofs.length === 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'At least one proof is required')
      }

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferStatus(offer, 'paid')
      ensureOfferOwnership(offer, request.user.id, 'buyer', 'Only the buyer can add more payment proofs')

      // Enforce total proof cap
      const [{ existingCount }] = await fastify.db
        .select({ existingCount: count() })
        .from(exchange_proofs)
        .where(and(eq(exchange_proofs.offer_id, id)))

      if (existingCount + proofs.length > MAX_TOTAL_PROOFS) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Cannot exceed ${MAX_TOTAL_PROOFS} total proofs per offer (currently have ${existingCount})`)
      }

      validateProofs(proofs, request.user.id)

      await fastify.db.insert(exchange_proofs).values(
        proofs.map(({ url, type }) => ({
          offer_id:       id,
          uploaded_by_id: request.user.id,
          url,
          type,
        }))
      )

      const detail = await buildOfferDetail(fastify.db, offer, request.user.id)
      return reply.code(201).send(detail)
    }
  )
}

export default exchangeAddProofs
