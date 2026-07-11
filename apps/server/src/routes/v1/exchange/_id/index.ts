/**
 * GET /v1/exchange/:id, exchange detail (cutover §3 rewrite): escrows ⨝
 * exchange_details + creator/counterparty refs, proofs, dispute and
 * reviews. Read-only; transitions live under /v1/escrows/:id/*.
 *
 * Drafts are private staging rows (fiat-rails opens them; my-offers lists
 * them), visible to their CREATOR only, 404 to everyone else.
 */
import { FastifyPluginAsync } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import {
  escrows,
  exchange_details,
  users,
  escrow_proofs,
  disputes,
  reviews,
  bank_accounts,
} from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ExchangeContract, ApiError, UserRef, ExchangePayoutAccount } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { canViewHidden } from '@server/lib/escrow-routes'
import { USER_COLS } from '@server/lib/users'

type GetRoute = ExchangeContract['get']

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString())

const exchangeById: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params

    const [row] = await fastify.db
      .select()
      .from(escrows)
      .innerJoin(exchange_details, eq(exchange_details.escrow_id, escrows.id))
      .where(eq(escrows.id, id))
      .limit(1)
    if (row === undefined) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
    }
    const escrow = row.escrows
    const details = row.exchange_details

    // Route is authenticated, the creator check needs no extra verify.
    if (escrow.status === 'draft' && escrow.creator_id !== request.user.id) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
    }

    // Taken-down offers (CO1) 404 to the public but stay visible to the
    // parties (the escrow may be mid-flight on-chain) and to admins.
    if (escrow.hidden && !canViewHidden(escrow, request.user.id, request.user.role)) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
    }

    const userIds =
      escrow.counterparty_id === null
        ? [escrow.creator_id]
        : [escrow.creator_id, escrow.counterparty_id]

    const [userRows, proofs, disputeRows, offerReviews] = await Promise.all([
      fastify.db.select(USER_COLS).from(users).where(inArray(users.id, userIds)),
      fastify.db.select().from(escrow_proofs).where(eq(escrow_proofs.escrow_id, id)),
      fastify.db.select().from(disputes).where(eq(disputes.escrow_id, id)).limit(1),
      fastify.db.select().from(reviews).where(eq(reviews.escrow_id, id)),
    ])

    const userMap = new Map<string, UserRef>(userRows.map((u) => [u.id, u]))
    const creator = userMap.get(escrow.creator_id)
    if (creator === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'escrow creator row missing')
    }
    const counterparty =
      escrow.counterparty_id === null ? null : (userMap.get(escrow.counterparty_id) ?? null)

    // Payout account is PII: reveal the full details only to the offer's
    // parties (creator + accepted counterparty), so a matched buyer knows
    // where to pay. Absent to everyone else, and before an account is linked.
    const isParty =
      request.user.id === escrow.creator_id || request.user.id === escrow.counterparty_id
    let payout_account: ExchangePayoutAccount | null = null
    if (isParty && details.payout_account_id !== null) {
      const [acct] = await fastify.db
        .select({
          kind: bank_accounts.kind,
          bank_code: bank_accounts.bank_code,
          account_number: bank_accounts.account_number,
          account_name: bank_accounts.account_name,
          country: bank_accounts.country,
        })
        .from(bank_accounts)
        .where(eq(bank_accounts.id, details.payout_account_id))
        .limit(1)
      payout_account = acct ?? null
    }

    return reply.send({
      escrow_id: escrow.id,
      chain_id: escrow.chain_id,
      asset: escrow.asset,
      amount_raw: escrow.amount_raw,
      status: escrow.status,
      fiat_amount: details.fiat_amount,
      fiat_currency: details.fiat_currency,
      rate: details.rate,
      payment_window_seconds: details.payment_window_seconds,
      accept_deadline: iso(escrow.accept_deadline),
      created_at: escrow.created_at.toISOString(),
      creator,
      payment_proof_url: details.payment_proof_url,
      dispute_bond_raw: escrow.dispute_bond_raw,
      completion_deadline: iso(escrow.completion_deadline),
      submitted_at: iso(escrow.submitted_at),
      approval_deadline: iso(escrow.approval_deadline),
      counterparty,
      proofs,
      dispute: disputeRows[0] ?? null,
      reviews: offerReviews,
      payout_account,
    })
  })
}

export default exchangeById
