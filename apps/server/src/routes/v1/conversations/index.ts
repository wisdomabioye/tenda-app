import { FastifyPluginAsync } from 'fastify'
import { and, eq, or, desc } from 'drizzle-orm'
import { conversations, messages, users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ConversationsContract, ApiError, Conversation } from '@tenda/shared'
import { isPostgresUniqueViolation } from '../../../lib/db'

type ListRoute = ConversationsContract['list']
type FindOrCreateRoute = ConversationsContract['findOrCreate']

/** Sort two UUIDs so user_a_id < user_b_id (canonical order). */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

const conversationsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /v1/conversations — list conversations for the authenticated user
  fastify.get<{
    Reply: ListRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user.id

      const rows = await fastify.db
        .select({
          id:              conversations.id,
          user_a_id:       conversations.user_a_id,
          user_b_id:       conversations.user_b_id,
          status:          conversations.status,
          closed_by:       conversations.closed_by,
          closed_at:       conversations.closed_at,
          last_message_at: conversations.last_message_at,
          created_at:      conversations.created_at,
        })
        .from(conversations)
        .where(
          and(
            or(eq(conversations.user_a_id, userId), eq(conversations.user_b_id, userId)),
            eq(conversations.status, 'active'),
          )
        )
        .orderBy(desc(conversations.last_message_at))

      // Fetch other-user profiles + unread counts + last message in parallel
      const result: Conversation[] = await Promise.all(
        rows.map(async (conv) => {
          const otherId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id

          const [otherUser] = await fastify.db
            .select({
              id:         users.id,
              first_name: users.first_name,
              last_name:  users.last_name,
              avatar_url: users.avatar_url,
            })
            .from(users)
            .where(eq(users.id, otherId))
            .limit(1)

          const latestMessages = await fastify.db
            .select({ id: messages.id, content: messages.content, read_at: messages.read_at, sender_id: messages.sender_id })
            .from(messages)
            .where(eq(messages.conversation_id, conv.id))
            .orderBy(desc(messages.created_at))
            .limit(20)

          const unread_count = latestMessages.filter(
            (m) => m.sender_id !== userId && !m.read_at
          ).length

          return {
            ...conv,
            closed_at:       conv.closed_at?.toISOString() ?? null,
            last_message_at: conv.last_message_at?.toISOString() ?? null,
            created_at:      conv.created_at?.toISOString() ?? null,
            other_user: {
              id:         otherUser?.id ?? otherId,
              first_name: otherUser?.first_name ?? null,
              last_name:  otherUser?.last_name ?? null,
              avatar_url: otherUser?.avatar_url ?? null,
            },
            unread_count,
            last_message: latestMessages[0]?.content ?? null,
          }
        }),
      )

      return result
    },
  )

  // POST /v1/conversations — find or create a conversation with another user
  fastify.post<{
    Body: FindOrCreateRoute['body']
    Reply: FindOrCreateRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user.id
      const { user_id: targetId } = request.body

      if (!targetId || typeof targetId !== 'string') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'user_id is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      if (targetId === userId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot start a conversation with yourself',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Verify target user exists
      const [targetUser] = await fastify.db
        .select({ id: users.id, first_name: users.first_name, last_name: users.last_name, avatar_url: users.avatar_url })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1)

      if (!targetUser) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
          code: ErrorCode.USER_NOT_FOUND,
        })
      }

      const [userA, userB] = canonicalPair(userId, targetId)

      // Try to find existing conversation (including closed ones — reopen on new contact)
      let [existing] = await fastify.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.user_a_id, userA), eq(conversations.user_b_id, userB)))
        .limit(1)

      if (!existing) {
        try {
          ;[existing] = await fastify.db
            .insert(conversations)
            .values({ user_a_id: userA, user_b_id: userB })
            .returning()
        } catch (err) {
          if (isPostgresUniqueViolation(err)) {
            // Race condition: another request created it simultaneously
            ;[existing] = await fastify.db
              .select()
              .from(conversations)
              .where(and(eq(conversations.user_a_id, userA), eq(conversations.user_b_id, userB)))
              .limit(1)
          } else {
            throw err
          }
        }
      } else if (existing.status === 'closed') {
        // Reopen a closed conversation when a new contact is initiated
        ;[existing] = await fastify.db
          .update(conversations)
          .set({ status: 'active', closed_by: null, closed_at: null })
          .where(eq(conversations.id, existing.id))
          .returning()
      }

      return {
        ...existing,
        closed_at:       existing.closed_at?.toISOString() ?? null,
        last_message_at: existing.last_message_at?.toISOString() ?? null,
        created_at:      existing.created_at?.toISOString() ?? null,
        other_user: {
          id:         targetUser.id,
          first_name: targetUser.first_name,
          last_name:  targetUser.last_name,
          avatar_url: targetUser.avatar_url,
        },
        unread_count: 0,
        last_message: null,
      }
    },
  )
}

export default conversationsRoute
