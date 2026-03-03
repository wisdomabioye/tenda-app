import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { conversations } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ConversationsContract, ApiError } from '@tenda/shared'

type CloseRoute = ConversationsContract['close']

const closeConversation: FastifyPluginAsync = async (fastify) => {
  // POST /v1/conversations/:id/close — close a conversation (hide it from inbox)
  fastify.post<{
    Params: CloseRoute['params']
    Reply: CloseRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user.id

      const [conv] = await fastify.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1)

      if (!conv) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Conversation not found',
          code: ErrorCode.NOT_FOUND,
        })
      }

      if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Not a participant of this conversation',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (conv.status === 'closed') {
        return {
          ...conv,
          closed_at:       conv.closed_at?.toISOString() ?? null,
          last_message_at: conv.last_message_at?.toISOString() ?? null,
          created_at:      conv.created_at?.toISOString() ?? null,
          other_user:      { id: '', first_name: null, last_name: null, avatar_url: null },
          unread_count:    0,
          last_message:    null,
        }
      }

      const [updated] = await fastify.db
        .update(conversations)
        .set({ status: 'closed', closed_by: userId, closed_at: new Date() })
        .where(eq(conversations.id, id))
        .returning()

      return {
        ...updated,
        closed_at:       updated.closed_at?.toISOString() ?? null,
        last_message_at: updated.last_message_at?.toISOString() ?? null,
        created_at:      updated.created_at?.toISOString() ?? null,
        other_user:      { id: '', first_name: null, last_name: null, avatar_url: null },
        unread_count:    0,
        last_message:    null,
      }
    },
  )
}

export default closeConversation
