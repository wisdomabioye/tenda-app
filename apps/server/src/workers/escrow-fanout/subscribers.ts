/**
 * New-gig fan-out: when the on-chain create confirms (escrow → open), notify
 * the gig_subscriptions whose city/category match.
 *
 * The matching is SQL, not application code, which is why it is covered by an
 * integration test rather than a fake store — a stub would assert the query we
 * wrote, not the rows postgres returns.
 */

import { and, eq, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { gig_subscriptions } from '@tenda/shared/db/schema'
import { escrows, gig_details } from '@tenda/shared/db/schema/escrow'
import { newGigNotice } from './copy'
import { enqueueEscrowNotice } from './enqueue-notice'

export async function fanOutNewGigToSubscribers(
  fastify: FastifyInstance,
  escrow_id: string,
): Promise<void> {
  const [gig] = await fastify.db
    .select({
      creator_id: escrows.creator_id,
      title: gig_details.title,
      city: gig_details.city,
      category: gig_details.category,
    })
    .from(escrows)
    .innerJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
    .where(and(eq(escrows.id, escrow_id), eq(escrows.kind, 'gig')))
    .limit(1)
  // Exchange escrows have no gig_details row, nothing to fan out.
  if (gig === undefined) return

  // Remote gigs match wildcard-city subscribers only; local gigs match
  // city + wildcard ('*' = any-value sentinel). Category filtered the same way.
  const subs = await fastify.db
    .select({ user_id: gig_subscriptions.user_id })
    .from(gig_subscriptions)
    .where(
      and(
        gig.city === null
          ? eq(gig_subscriptions.city, '*')
          : or(eq(gig_subscriptions.city, gig.city), eq(gig_subscriptions.city, '*')),
        or(eq(gig_subscriptions.category, gig.category), eq(gig_subscriptions.category, '*')),
      ),
    )

  // Deduped because one user can hold several subscriptions that all match;
  // the poster is dropped because they already know they posted it.
  const subscriberIds = [...new Set(subs.map((s) => s.user_id))].filter(
    (uid) => uid !== gig.creator_id,
  )

  await enqueueEscrowNotice(
    fastify.queue,
    escrow_id,
    'gig',
    subscriberIds,
    newGigNotice(gig.title, gig.city),
  )
}
