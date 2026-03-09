// Fastify plugin that registers all push-notification event listeners.
// Loaded by AutoLoad after db.ts, so fastify.db is available.
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { eq, or, inArray } from 'drizzle-orm'
import { device_tokens, gig_subscriptions } from '@tenda/shared/db/schema'
import { appEvents } from '../lib/events'
import { sendPush } from '../lib/push'

const notificationsPlugin: FastifyPluginAsync = async (fastify) => {
  async function tokensFor(...userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds.filter(Boolean))]
    if (unique.length === 0) return []
    const conditions = unique.map((id) => eq(device_tokens.user_id, id))
    const rows = await fastify.db
      .select({ token: device_tokens.token })
      .from(device_tokens)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    return rows.map((r) => r.token)
  }

  // Removes tokens that Expo reported as no longer registered.
  async function removeStaleTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return
    await fastify.db
      .delete(device_tokens)
      .where(inArray(device_tokens.token, tokens))
  }

  // ── Gig accepted → notify poster ──────────────────────────────────────────
  appEvents.on('gig.accepted', async (data) => {
    try {
      const tokens = await tokensFor(data.posterId)
      const stale = await sendPush(tokens, {
        title: 'Gig Accepted',
        body: `Your gig "${data.title}" was accepted by a worker.`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] gig.accepted listener failed')
    }
  })

  // ── Gig submitted → notify poster ────────────────────────────────────────
  appEvents.on('gig.submitted', async (data) => {
    try {
      const tokens = await tokensFor(data.posterId)
      const stale = await sendPush(tokens, {
        title: 'Proof Submitted',
        body: `The worker submitted proof for "${data.title}". Review and approve.`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] gig.submitted listener failed')
    }
  })

  // ── Gig approved → notify worker ─────────────────────────────────────────
  appEvents.on('gig.approved', async (data) => {
    try {
      const tokens = await tokensFor(data.workerId)
      const stale = await sendPush(tokens, {
        title: 'Payment Released',
        body: `Your work on "${data.title}" was approved and payment released.`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] gig.approved listener failed')
    }
  })

  // ── Gig disputed → notify the other party ────────────────────────────────
  appEvents.on('gig.disputed', async (data) => {
    try {
      const recipientId = data.raisedById === data.posterId ? data.workerId : data.posterId
      const tokens = await tokensFor(recipientId)
      const stale = await sendPush(tokens, {
        title: 'Dispute Raised',
        body: `A dispute was raised for "${data.title}". An admin will review shortly.`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] gig.disputed listener failed')
    }
  })

  // ── Gig resolved → notify both parties ───────────────────────────────────
  appEvents.on('gig.resolved', async (data) => {
    try {
      const tokens = await tokensFor(data.posterId, data.workerId)
      const stale = await sendPush(tokens, {
        title: 'Dispute Resolved',
        body: `The dispute for "${data.title}" has been resolved.`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] gig.resolved listener failed')
    }
  })

  // ── New gig created → fan-out to matching subscribers ────────────────────
  // Fire-and-forget: runs in background, does not block the gig creation request.
  appEvents.on('gig.created', (data) => {
    void (async () => {
      try {
        const subs = await fastify.db
          .select({ user_id: gig_subscriptions.user_id, category: gig_subscriptions.category })
          .from(gig_subscriptions)
          // Remote gigs match wildcard-city subscribers only; local gigs match city + wildcard
          .where(
            data.city
              ? or(eq(gig_subscriptions.city, data.city), eq(gig_subscriptions.city, '*'))
              : eq(gig_subscriptions.city, '*'),
          )

        const subscriberIds = [...new Set(
          subs
            .filter((s) => s.category === data.category || s.category === '*')
            .map((s) => s.user_id),
        )]

        if (subscriberIds.length === 0) return

        const conditions = subscriberIds.map((id) => eq(device_tokens.user_id, id))
        const tokenRows = await fastify.db
          .select({ token: device_tokens.token })
          .from(device_tokens)
          .where(conditions.length === 1 ? conditions[0] : or(...conditions))

        const locationLabel = data.city ?? 'Remote'
        const stale = await sendPush(tokenRows.map((r) => r.token), {
          title: 'New Gig Posted',
          body: `"${data.title}" in ${locationLabel}`,
          data: { screen: 'gig', gigId: data.gigId },
        })
        await removeStaleTokens(stale)
      } catch (err) {
        fastify.log.error({ err }, '[notifications] gig.created fan-out failed')
      }
    })()
  })

  // ── Proof added → notify poster ──────────────────────────────────────────
  appEvents.on('proof.added', async (data) => {
    try {
      const tokens = await tokensFor(data.posterId)
      const stale = await sendPush(tokens, {
        title: 'Additional Proof Submitted',
        body: `The worker added more proof for "${data.title}". Review and approve.`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] proof.added listener failed')
    }
  })

  // ── Review submitted → notify reviewee ───────────────────────────────────
  appEvents.on('review.submitted', async (data) => {
    try {
      const tokens = await tokensFor(data.revieweeId)
      const stale = await sendPush(tokens, {
        title: 'New Review',
        body: `You received a ${data.score}-star review for "${data.title}".`,
        data: { screen: 'gig', gigId: data.gigId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] review.submitted listener failed')
    }
  })

  // ── New message → notify recipient ───────────────────────────────────────
  appEvents.on('message.sent', async (data) => {
    try {
      const tokens = await tokensFor(data.recipientId)
      const stale = await sendPush(tokens, {
        title: 'New Message',
        body: data.preview,
        data: { screen: 'chat', conversationId: data.conversationId, userId: data.senderId },
      })
      await removeStaleTokens(stale)
    } catch (err) {
      fastify.log.error({ err }, '[notifications] message.sent listener failed')
    }
  })
}

export default fp(notificationsPlugin, {
  name: 'notifications',
  dependencies: ['db'],
})
