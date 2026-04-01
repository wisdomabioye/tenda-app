import { FastifyPluginAsync } from 'fastify'
import { eq, isNull, desc, sql } from 'drizzle-orm'
import { disputes, gigs, users } from '@tenda/shared/db/schema'
import { MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import type { ApiError } from '@tenda/shared'

const adminDisputes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/disputes — list open (unresolved) disputes for triage
  // Role: support, dispute_resolver, super_admin
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/', { 
    preHandler: [requireRole('support', 'dispute_resolver', 'super_admin')] 
  }, async (request) => {
    const { limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const where = isNull(disputes.resolved_at)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({
          id:                   disputes.id,
          gig_id:               disputes.gig_id,
          gig_title:            gigs.title,
          raised_by_id:         disputes.raised_by_id,
          raised_by_first_name: users.first_name,
          raised_by_last_name:  users.last_name,
          reason:               disputes.reason,
          raised_at:            disputes.raised_at,
        })
        .from(disputes)
        .innerJoin(gigs,  eq(disputes.gig_id,      gigs.id))
        .innerJoin(users, eq(disputes.raised_by_id, users.id))
        .where(where)
        .orderBy(desc(disputes.raised_at))
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(disputes)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })
}

export default adminDisputes
