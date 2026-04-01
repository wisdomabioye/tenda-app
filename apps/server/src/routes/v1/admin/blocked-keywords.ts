import { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { blocked_keywords } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
import type { ApiError } from '@tenda/shared'

// All blocked-keyword routes: moderator + super_admin only (role matrix: "Manage blocked keywords")
const KEYWORD_ROLES = ['moderator', 'super_admin'] as const

const adminBlockedKeywords: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/blocked-keywords
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
  }>('/', { 
    preHandler: [requireRole(...KEYWORD_ROLES)] 
  }, async (request) => {
    const { limit = 50, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({ id: blocked_keywords.id, keyword: blocked_keywords.keyword, added_by: blocked_keywords.added_by, created_at: blocked_keywords.created_at })
        .from(blocked_keywords)
        .orderBy(blocked_keywords.created_at)
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(blocked_keywords),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // POST /v1/admin/blocked-keywords
  fastify.post<{
    Body:  { keyword: string }
    Reply: { id: string; keyword: string } | ApiError
  }>('/', { preHandler: [requireRole(...KEYWORD_ROLES)] }, async (request, reply) => {
    const { keyword } = request.body

    if (!keyword || keyword.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'keyword is required')
    }

    const normalised = keyword.trim().toLowerCase()

    const [inserted] = await fastify.db
      .insert(blocked_keywords)
      .values({ keyword: normalised, added_by: request.user.id })
      .onConflictDoNothing()
      .returning({ id: blocked_keywords.id, keyword: blocked_keywords.keyword })

    if (!inserted) throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Keyword already exists')

    fastify.invalidateBlocklistCache()
    appEvents.emit('admin.add_keyword', {
      adminId:     request.user.id,
      adminWallet: request.user.wallet_address,
      adminRole:   request.user.role,
      keyword:     normalised,
    })

    return reply.code(201).send(inserted)
  })

  // DELETE /v1/admin/blocked-keywords/:id
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole(...KEYWORD_ROLES)] },
    async (request, reply) => {
      const [deleted] = await fastify.db
        .delete(blocked_keywords)
        .where(eq(blocked_keywords.id, request.params.id))
        .returning({ id: blocked_keywords.id, keyword: blocked_keywords.keyword })

      if (!deleted) throw new AppError(404, ErrorCode.NOT_FOUND, 'Keyword not found')

      fastify.invalidateBlocklistCache()
      appEvents.emit('admin.remove_keyword', {
        adminId:     request.user.id,
        adminWallet: request.user.wallet_address,
        adminRole:   request.user.role,
        keywordId:   deleted.id,
        keyword:     deleted.keyword,
      })

      return reply.code(204).send()
    },
  )

  // POST /v1/admin/blocked-keywords/refresh — instant cache bust
  fastify.post('/refresh', { preHandler: [requireRole(...KEYWORD_ROLES)] }, async (_request, reply) => {
    fastify.invalidateBlocklistCache()
    return reply.code(204).send()
  })
}

export default adminBlockedKeywords
