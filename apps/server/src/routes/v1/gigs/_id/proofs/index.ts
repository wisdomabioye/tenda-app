import { FastifyPluginAsync } from 'fastify'
import { and, count, eq } from 'drizzle-orm'
import { gigs, gig_proofs } from '@tenda/shared/db/schema'
import { isCloudinaryUrl, ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'

type AddProofsRoute = GigsContract['addProofs']

const MAX_TOTAL_PROOFS = 20

const addProofs: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/proofs — worker adds supplementary proof to a submitted gig.
  // No on-chain transaction required: the escrow is already in submitted state.
  // The poster may request additional evidence before approving; this satisfies that need.
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

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Gig not found',
          code: ErrorCode.GIG_NOT_FOUND,
        })
      }

      if (gig.status !== 'submitted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Additional proof can only be added to a submitted gig',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.worker_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the assigned worker can add proof',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (!proofs || proofs.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'At least one proof is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Enforce total proof cap across all submissions
      const [{ existingCount }] = await fastify.db
        .select({ existingCount: count() })
        .from(gig_proofs)
        .where(and(eq(gig_proofs.gig_id, id)))

      if (existingCount + proofs.length > MAX_TOTAL_PROOFS) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Cannot exceed ${MAX_TOTAL_PROOFS} total proofs per gig (currently have ${existingCount})`,
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const VALID_PROOF_TYPES = ['image', 'video', 'document'] as const
      const invalidType = proofs.find(
        ({ type }) => !VALID_PROOF_TYPES.includes(type as typeof VALID_PROOF_TYPES[number])
      )
      if (invalidType) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Proof type must be "image", "video", or "document"',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const invalidProof = proofs.find(({ url }) => !isCloudinaryUrl(url))
      if (invalidProof) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'All proof URLs must be hosted on Cloudinary (https://res.cloudinary.com/)',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const inserted = await fastify.db
        .insert(gig_proofs)
        .values(proofs.map(({ url, type }) => ({
          gig_id:         id,
          uploaded_by_id: request.user.id,
          url,
          type,
        })))
        .returning()

      return reply.code(201).send(inserted)
    }
  )
}

export default addProofs
