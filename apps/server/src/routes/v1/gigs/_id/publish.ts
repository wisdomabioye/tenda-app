import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { deriveEscrowAddress, computePlatformFee } from '../../../../lib/solana'
import type { GigsContract, ApiError } from '@tenda/shared'

type PublishRoute = GigsContract['publish']

const publishGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/publish — draft → open
  // Poster calls create_gig_escrow on Solana first, then posts the signature here.
  // Server derives the escrow PDA and records the create_escrow transaction.
  fastify.post<{
    Params: PublishRoute['params']
    Body: PublishRoute['body']
    Reply: PublishRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body

      if (!signature) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'signature is required' })
      }

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the poster can publish this gig' })
      }

      if (gig.status !== 'draft') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Only draft gigs can be published' })
      }

      const escrow_address = deriveEscrowAddress(gig.id)
      const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 250)
      const platform_fee_lamports = computePlatformFee(gig.payment_lamports, feeBps)

      const [updated] = await fastify.db
        .update(gigs)
        .set({ status: 'open', escrow_address, updated_at: new Date() })
        .where(eq(gigs.id, id))
        .returning()

      await fastify.db.insert(gig_transactions).values({
        gig_id:               id,
        type:                 'create_escrow',
        signature,
        amount_lamports:      gig.payment_lamports + platform_fee_lamports,
        platform_fee_lamports,
      })

      return updated
    }
  )
}

export default publishGig
