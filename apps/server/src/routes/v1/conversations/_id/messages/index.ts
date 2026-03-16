import { FastifyPluginAsync } from 'fastify'
import { and, eq, lt, lte, or, desc, isNull, ne, sql } from 'drizzle-orm'
import { conversations, messages, gigs, exchange_offers } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { appEvents } from '@server/lib/events'
import { moderateBody } from '@server/lib/moderation'
import { AppError } from '@server/lib/errors'
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
    async (request) => {
      const { id } = request.params
      const { before_id, limit = MESSAGES_PAGE_SIZE } = request.query ?? {}
      const userId = request.user.id

      const [conv] = await fastify.db
        .select({ id: conversations.id, user_a_id: conversations.user_a_id, user_b_id: conversations.user_b_id })
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1)

      if (!conv) throw new AppError(404, ErrorCode.NOT_FOUND, 'Conversation not found')
      if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Not a participant of this conversation')
      }

      const pageSize = Math.min(Number(limit) || MESSAGES_PAGE_SIZE, 100)

      let cursorCreatedAt: Date | undefined
      if (before_id) {
        const [cursorMsg] = await fastify.db
          .select({ created_at: messages.created_at })
          .from(messages)
          .where(and(eq(messages.id, before_id), eq(messages.conversation_id, id)))
          .limit(1)
        if (cursorMsg?.created_at) cursorCreatedAt = cursorMsg.created_at
      }

      // Compound cursor: (created_at < X) OR (created_at = X AND id < before_id)
      // Prevents gaps when two messages share the same timestamp.
      const cursorCondition = cursorCreatedAt
        ? or(
            lt(messages.created_at,  cursorCreatedAt),
            and(lte(messages.created_at, cursorCreatedAt), lt(messages.id, before_id!)),
          )!
        : undefined

      const rows = await fastify.db
        .select({
          id:              messages.id,
          conversation_id: messages.conversation_id,
          sender_id:       messages.sender_id,
          gig_id:      messages.gig_id,
          gig_title:   gigs.title,
          offer_id:    messages.offer_id,
          offer_title: sql<string | null>`CASE WHEN ${exchange_offers.id} IS NOT NULL THEN ${exchange_offers.fiat_amount}::text || ' ' || ${exchange_offers.fiat_currency} ELSE NULL END`,
          content:     messages.content,
          read_at:     messages.read_at,
          created_at:  messages.created_at,
        })
        .from(messages)
        .leftJoin(gigs, eq(messages.gig_id, gigs.id))
        .leftJoin(exchange_offers, eq(messages.offer_id, exchange_offers.id))
        .where(
          cursorCondition
            ? and(eq(messages.conversation_id, id), cursorCondition)
            : eq(messages.conversation_id, id)
        )
        .orderBy(desc(messages.created_at))
        .limit(pageSize)

      // Mark all unread messages from the other user as read (not just this page).
      // Awaited so the badge clears reliably before the response returns.
      // @scalability: replace with a dedicated POST /v1/conversations/:id/read endpoint
      // (client-driven explicit read receipt) when per-message granularity or
      // read-only GET caching becomes a requirement.
      await fastify.db
        .update(messages)
        .set({ read_at: new Date() })
        .where(
          and(
            eq(messages.conversation_id, id),
            ne(messages.sender_id, userId),
            isNull(messages.read_at),
          )
        )

      return rows.map((m) => ({
        ...m,
        gig_title:   m.gig_title ?? null,
        offer_title: m.offer_title ?? null,
        read_at:     m.read_at?.toISOString() ?? null,
        created_at:  m.created_at?.toISOString() ?? null,
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
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate, moderateBody<SendMessageRoute['body']>(fastify, ['content'])] },
    async (request, reply) => {
      const { id } = request.params
      const { content, gig_id, offer_id } = request.body
      const userId = request.user.id

      if (!content || content.trim().length === 0) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'content is required')
      if (content.length > 2000) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message content must be at most 2000 characters')

      const [conv] = await fastify.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1)

      if (!conv) throw new AppError(404, ErrorCode.NOT_FOUND, 'Conversation not found')
      if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Not a participant of this conversation')
      }

      // Pre-check outside the transaction for a fast path, but the definitive
      // check is inside the transaction with a row lock to guard against concurrent closes.
      if (conv.status === 'closed') throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'This conversation has been closed')

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
            gig_id:          gig_id  ?? null,
            offer_id:        offer_id ?? null,
            content:         content.trim(),
          })
          .returning()

        await tx
          .update(conversations)
          .set({ last_message_at: new Date() })
          .where(eq(conversations.id, id))

        return msg
      })

      if (!newMessage) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'This conversation has been closed')

      let gig_title: string | null = null
      if (newMessage.gig_id) {
        const [g] = await fastify.db
          .select({ title: gigs.title })
          .from(gigs)
          .where(eq(gigs.id, newMessage.gig_id))
          .limit(1)
        gig_title = g?.title ?? null
      }

      let offer_title: string | null = null
      if (newMessage.offer_id) {
        const [o] = await fastify.db
          .select({ fiat_amount: exchange_offers.fiat_amount, fiat_currency: exchange_offers.fiat_currency })
          .from(exchange_offers)
          .where(eq(exchange_offers.id, newMessage.offer_id))
          .limit(1)
        offer_title = o ? `${o.fiat_amount} ${o.fiat_currency}` : null
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
        gig_title,
        offer_title,
        read_at:    newMessage.read_at?.toISOString() ?? null,
        created_at: newMessage.created_at?.toISOString() ?? null,
      })
    },
  )
}

export default messagesRoute
