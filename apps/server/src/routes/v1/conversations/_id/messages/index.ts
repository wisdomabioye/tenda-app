import { FastifyPluginAsync } from 'fastify'
import { and, eq, lt, desc, isNull, ne } from 'drizzle-orm'
import { conversations, messages } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { appEvents } from '../../../../../lib/events'
import type { ConversationsContract, ApiError } from '@tenda/shared'

type GetMessagesRoute = ConversationsContract['messages']
type SendMessageRoute = ConversationsContract['sendMessage']

const MESSAGES_PAGE_SIZE = 30

const messagesRoute: FastifyPluginAsync = async (fastify) => {
  // GET /v1/conversations/:id/messages — paginated message history (cursor-based, newest first)
  fastify.get<{
    Params: GetMessagesRoute['params']
    Querystring: GetMessagesRoute['query']
    Reply: GetMessagesRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { before_id, limit = MESSAGES_PAGE_SIZE } = request.query ?? {}
      const userId = request.user.id

      const [conv] = await fastify.db
        .select({ id: conversations.id, user_a_id: conversations.user_a_id, user_b_id: conversations.user_b_id })
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

      const pageSize = Math.min(Number(limit) || MESSAGES_PAGE_SIZE, 100)

      let cursor: Date | undefined
      if (before_id) {
        const [cursorMsg] = await fastify.db
          .select({ created_at: messages.created_at })
          .from(messages)
          .where(eq(messages.id, before_id))
          .limit(1)
        if (cursorMsg?.created_at) cursor = cursorMsg.created_at
      }

      const rows = await fastify.db
        .select()
        .from(messages)
        .where(
          cursor
            ? and(eq(messages.conversation_id, id), lt(messages.created_at, cursor))
            : eq(messages.conversation_id, id)
        )
        .orderBy(desc(messages.created_at))
        .limit(pageSize)

      // Mark all unread messages from the other user as read (not just this page)
      void fastify.db
        .update(messages)
        .set({ read_at: new Date() })
        .where(
          and(
            eq(messages.conversation_id, id),
            ne(messages.sender_id, userId),
            isNull(messages.read_at),
          )
        )
        .catch(() => {})

      return rows.map((m) => ({
        ...m,
        read_at:    m.read_at?.toISOString() ?? null,
        created_at: m.created_at?.toISOString() ?? null,
      }))
    },
  )

  // POST /v1/conversations/:id/messages — send a message
  fastify.post<{
    Params: SendMessageRoute['params']
    Body: SendMessageRoute['body']
    Reply: SendMessageRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { content, gig_id } = request.body
      const userId = request.user.id

      if (!content || content.trim().length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'content is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      if (content.length > 2000) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Message content must be at most 2000 characters',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

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

      // Pre-check outside the transaction for a fast path, but the definitive
      // check is inside the transaction with a row lock to guard against concurrent closes.
      if (conv.status === 'closed') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'This conversation has been closed',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const newMessage = await fastify.db.transaction(async (tx) => {
        // Re-read with FOR UPDATE to prevent a concurrent close from racing the INSERT.
        const [current] = await tx
          .select({ status: conversations.status })
          .from(conversations)
          .where(eq(conversations.id, id))
          .for('update')
          .limit(1)

        if (!current || current.status === 'closed') return null

        const [msg] = await tx
          .insert(messages)
          .values({
            conversation_id: id,
            sender_id:       userId,
            gig_id:          gig_id ?? null,
            content:         content.trim(),
          })
          .returning()

        await tx
          .update(conversations)
          .set({ last_message_at: new Date() })
          .where(eq(conversations.id, id))

        return msg
      })

      if (!newMessage) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'This conversation has been closed',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const recipientId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id
      const preview = content.trim().slice(0, 100)

      appEvents.emit('message.sent', {
        conversationId: id,
        senderId:       userId,
        recipientId,
        preview,
      })

      return reply.code(201).send({
        ...newMessage,
        read_at:    newMessage.read_at?.toISOString() ?? null,
        created_at: newMessage.created_at?.toISOString() ?? null,
      })
    },
  )
}

export default messagesRoute
