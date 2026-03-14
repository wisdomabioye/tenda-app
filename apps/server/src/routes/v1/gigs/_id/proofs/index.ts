import { FastifyPluginAsync } from 'fastify'
import { and, count, eq } from 'drizzle-orm'
import { gig_proofs } from '@tenda/shared/db/schema'
import { isCloudinaryUrl, ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'

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

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'submitted')
      ensureGigOwnership(gig, request.user.id, 'worker')

      if (!proofs || proofs.length === 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'At least one proof is required')
      }

      // Enforce total proof cap across all submissions
      const [{ existingCount }] = await fastify.db
        .select({ existingCount: count() })
        .from(gig_proofs)
        .where(and(eq(gig_proofs.gig_id, id)))

      if (existingCount + proofs.length > MAX_TOTAL_PROOFS) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Cannot exceed ${MAX_TOTAL_PROOFS} total proofs per gig (currently have ${existingCount})`)
      }

      const VALID_PROOF_TYPES = ['image', 'video', 'document'] as const
      const invalidType = proofs.find(
        ({ type }) => !VALID_PROOF_TYPES.includes(type as typeof VALID_PROOF_TYPES[number])
      )
      if (invalidType) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Proof type must be "image", "video", or "document"')
      }

      const invalidProof = proofs.find(({ url }) => !isCloudinaryUrl(url))
      if (invalidProof) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'All proof URLs must be hosted on Cloudinary (https://res.cloudinary.com/)')
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

      appEvents.emit('proof.added', {
        gigId:    id,
        posterId: gig.poster_id,
        workerId: gig.worker_id!,
        title:    gig.title,
      })

      return reply.code(201).send(inserted)
    }
  )
}

export default addProofs
