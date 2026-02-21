import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, disputes, gig_transactions } from '@tenda/shared/db/schema'
import { computePlatformFee } from '../../../../lib/solana'
import type { GigsContract, ApiError } from '@tenda/shared'

type ResolveRoute = GigsContract['resolve']

const resolveDispute: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/resolve — admin resolves dispute
  // The authenticated user's wallet address is recorded as the resolver.
  fastify.post<{
    Params: ResolveRoute['params']
    Body: ResolveRoute['body']
    Reply: ResolveRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { winner, signature } = request.body

      if (!winner || !signature) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'winner and signature are required' })
      }

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.status !== 'disputed') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Gig must be in disputed status to resolve' })
      }

      const resolverWalletAddress = request.user.wallet_address
      const now = new Date()

      const [updated] = await fastify.db
        .update(gigs)
        .set({ status: 'resolved', updated_at: now })
        .where(eq(gigs.id, id))
        .returning()

      await fastify.db
        .update(disputes)
        .set({ winner, resolver_wallet_address: resolverWalletAddress, resolved_at: now })
        .where(eq(disputes.gig_id, id))

      const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 250)
      const platform_fee_lamports = computePlatformFee(gig.payment_lamports, feeBps)

      await fastify.db.insert(gig_transactions).values({
        gig_id:               id,
        type:                 'dispute_resolved',
        signature,
        amount_lamports:      gig.payment_lamports,
        platform_fee_lamports,
      })

      return updated
    }
  )
}

export default resolveDispute
