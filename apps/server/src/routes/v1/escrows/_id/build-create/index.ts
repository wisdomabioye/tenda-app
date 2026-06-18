/**
 * POST /v1/escrows/:id/build-create — rebuild the unsigned createEscrow tx
 * for an OWNED DRAFT, giving server-opened drafts a publish path (CO4
 * residual: fiat-offramp sell offers are inserted without an unsigned tx)
 * and signing-declined drafts a retry that keeps their id.
 *
 * Drafts are pre-publish staging rows, so a lapsed/missing accept deadline
 * is refreshed (shared default window) rather than rejected — nothing the
 * counterparty saw has changed. The buyer-visible terms (asset, amount,
 * rate) are never touched here.
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { DEFAULT_ACCEPT_WINDOW_SECONDS, ErrorCode } from '@tenda/shared'
import { escrows, exchange_details, tx_attempts } from '@tenda/shared/db/schema'
import { AppError } from '@server/lib/errors'
import { loadEscrowOr404 } from '@server/lib/escrow-routes'
import { requireGoodStanding } from '@server/features/reputation/guards'
import { requireProfileComplete } from '@server/lib/guards'
import { assertCanTransact } from '@server/lib/auth/resolver'

/** Deadlines closer than this get refreshed — the program rejects a create
 *  whose accept window is already (about to be) over. */
const REFRESH_MARGIN_MS = 60_000

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/',
    // Publishing IS creating a live listing — same gates as POST /v1/escrows.
    { preHandler: [fastify.authenticate, requireProfileComplete, requireGoodStanding('create')] },
    async (request) => {
      const escrow = await loadEscrowOr404(fastify.db, request.params.id)
      if (escrow.creator_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the creator can publish a draft')
      }
      if (escrow.status !== 'draft') {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          'Only drafts can be published — this escrow already left the draft state',
        )
      }

      // A signed-and-broadcast create may still be verifying — building a
      // second create tx now would just fail on-chain (the PDA exists) and
      // confuse the client. Same guard as DELETE /v1/escrows/:id.
      const [pendingCreate] = await fastify.db
        .select({ id: tx_attempts.id })
        .from(tx_attempts)
        .where(
          and(
            eq(tx_attempts.escrow_id, escrow.id),
            eq(tx_attempts.action, 'create'),
            isNull(tx_attempts.confirmed_at),
            isNull(tx_attempts.failed_at),
          ),
        )
        .limit(1)
      if (pendingCreate !== undefined) {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          'A create transaction is awaiting confirmation — wait for it to settle',
        )
      }

      // Completion window: gigs always carry it (the create flow demands
      // it); server-opened exchange drafts may predate the stamped insert —
      // fall back to the offer's fiat payment window.
      let completion_duration_seconds = escrow.completion_duration_seconds
      if (completion_duration_seconds === null && escrow.kind === 'exchange') {
        const [details] = await fastify.db
          .select({ payment_window_seconds: exchange_details.payment_window_seconds })
          .from(exchange_details)
          .where(eq(exchange_details.escrow_id, escrow.id))
          .limit(1)
        completion_duration_seconds = details?.payment_window_seconds ?? null
      }
      if (completion_duration_seconds === null) {
        throw new AppError(
          422,
          ErrorCode.VALIDATION_ERROR,
          'Draft has no completion window — delete it and create the listing again',
        )
      }

      // Refresh a lapsed/missing accept deadline (pre-publish: the listing
      // window is ours to restart, the offer terms are untouched).
      const now = Date.now()
      let accept_deadline = escrow.accept_deadline
      if (accept_deadline === null || accept_deadline.getTime() <= now + REFRESH_MARGIN_MS) {
        accept_deadline = new Date(now + DEFAULT_ACCEPT_WINDOW_SECONDS * 1000)
      }

      // Persist what the unsigned tx will encode, so the DB row and the
      // on-chain account can never disagree after confirmation.
      if (
        accept_deadline !== escrow.accept_deadline ||
        completion_duration_seconds !== escrow.completion_duration_seconds
      ) {
        await fastify.db
          .update(escrows)
          .set({ accept_deadline, completion_duration_seconds })
          .where(and(eq(escrows.id, escrow.id), eq(escrows.status, 'draft')))
      }

      // The chain may have been deconfigured since the draft was created
      // (e.g. BASE env removed) — surface a clean 503, not a raw throw.
      if (!fastify.chains.has(escrow.chain_id)) {
        throw new AppError(
          503,
          ErrorCode.SERVICE_UNAVAILABLE,
          `chain '${escrow.chain_id}' is not currently available`,
        )
      }
      const adapter = fastify.chains.get(escrow.chain_id)
      // Publishing IS creating — same first-transaction gate as POST /v1/escrows
      // (covers server-opened fiat-offramp drafts that never hit create's gate).
      await assertCanTransact(fastify.db, request.user.id, adapter.namespace)
      const unsigned = await adapter.buildTx({
        action: 'createEscrow',
        user_id: request.user.id,
        payload: {
          escrow_id: escrow.id,
          kind: escrow.kind,
          asset: escrow.asset,
          amount_raw: escrow.amount_raw,
          ...(escrow.assigned_counterparty_id !== null
            ? { assigned_counterparty_user_id: escrow.assigned_counterparty_id }
            : {}),
          accept_deadline_unix: Math.floor(accept_deadline.getTime() / 1000),
          completion_duration_seconds,
          dispute_bond_raw: escrow.dispute_bond_raw,
          is_seeker: escrow.is_seeker,
        },
      })

      return { escrow_id: escrow.id, unsigned }
    },
  )
}

export default route
