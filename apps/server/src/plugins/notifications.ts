// Fastify plugin that translates in-process app events into push
// notifications. Post-cutover (#34, checklist §3) listeners do NOT push
// directly — they enqueue 'notifications' jobs; workers/processors.ts
// resolves device tokens at delivery time and routes per platform.
//
// Escrow lifecycle pushes do not ride this plugin: verify-tx republish
// (workers/processors.ts § fanOutEscrowEvent) owns those.
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { appEvents } from '@server/lib/events'

const notificationsPlugin: FastifyPluginAsync = async (fastify) => {
  async function notify(
    user_id: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    await fastify.queue.enqueue('notifications', { user_id, title, body, data })
  }

  // ── New message → notify recipient ───────────────────────────────────────
  appEvents.on('message.sent', async (data) => {
    try {
      await notify(data.recipientId, 'New Message', data.preview, {
        screen: 'chat',
        conversationId: data.conversationId,
        userId: data.senderId,
      })
    } catch (err) {
      fastify.log.error({ err }, '[notifications] message.sent listener failed')
    }
  })

  // ── Review submitted → notify reviewee ───────────────────────────────────
  appEvents.on('review.submitted', async (data) => {
    try {
      const subject = data.title === null ? 'your exchange' : `"${data.title}"`
      await notify(
        data.revieweeId,
        'New Review',
        `You received a ${data.score}-star review for ${subject}.`,
        { screen: 'escrow', escrowId: data.escrowId },
      )
    } catch (err) {
      fastify.log.error({ err }, '[notifications] review.submitted listener failed')
    }
  })

  // ── Stage 8: fiat intent settled / failed → notify the user ─────────────
  appEvents.on('fiat.settled', async (data) => {
    try {
      await notify(
        data.user_id,
        data.direction === 'onramp' ? 'Funds Arrived' : 'Cash-out Complete',
        data.direction === 'onramp'
          ? 'Your purchase settled — the funds are in your wallet.'
          : `Your ${data.fiat_currency} payout was sent to your bank.`,
        { screen: 'fiat-intent', intentId: data.intent_id },
      )
    } catch (err) {
      fastify.log.error({ err }, '[notifications] fiat.settled listener failed')
    }
  })

  appEvents.on('fiat.failed', async (data) => {
    try {
      await notify(
        data.user_id,
        data.direction === 'onramp' ? 'Purchase Failed' : 'Cash-out Failed',
        data.reason,
        { screen: 'fiat-intent', intentId: data.intent_id },
      )
    } catch (err) {
      fastify.log.error({ err }, '[notifications] fiat.failed listener failed')
    }
  })
}

export default fp(notificationsPlugin, {
  name: 'notifications',
  dependencies: ['db', 'queue'],
})
