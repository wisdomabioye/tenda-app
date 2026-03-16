import { eq, and, inArray, isNotNull, sql } from 'drizzle-orm'
import {
  exchange_offers,
  user_exchange_accounts,
  exchange_proofs,
  exchange_disputes,
  users,
} from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ExchangeOffer, ExchangeOfferDetail, ExchangeOfferStatus } from '@tenda/shared'
import type { AppDatabase } from '../plugins/db'
import { AppError } from './errors'
import { USER_COLS } from './users'

/**
 * Fetches an exchange offer by id. Throws a 404 AppError if not found.
 */
export async function ensureOfferExists(db: AppDatabase, id: string): Promise<ExchangeOffer> {
  const [offer] = await db.select().from(exchange_offers).where(eq(exchange_offers.id, id)).limit(1)
  if (!offer) throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
  return offer
}

/**
 * Throws a 409 AppError if the offer is not in one of the allowed statuses.
 */
export function ensureOfferStatus(offer: Pick<ExchangeOffer, 'status'>, ...allowed: ExchangeOfferStatus[]): void {
  if (!allowed.includes(offer.status as ExchangeOfferStatus)) {
    throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, `Offer must be ${allowed.join(' or ')} to perform this action`)
  }
}

/**
 * Throws a 403 AppError if userId does not match the expected role on the offer.
 * role 'seller' — checks seller_id === userId
 * role 'buyer'  — checks buyer_id === userId
 */
export function ensureOfferOwnership(
  offer: Pick<ExchangeOffer, 'seller_id' | 'buyer_id'>,
  userId: string,
  role: 'seller' | 'buyer',
  message?: string,
): void {
  const ok = role === 'seller' ? offer.seller_id === userId : offer.buyer_id === userId
  if (!ok) throw new AppError(403, ErrorCode.FORBIDDEN, message ?? `Only the ${role} can perform this action`)
}

/**
 * Throws a 409 AppError if a TOCTOU-guarded DB update returned no row.
 * Use after transactions that include a status guard in the WHERE clause.
 */
export function ensureOfferTxUpdated<T>(result: T | null | undefined, message: string): T {
  if (result == null) throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, message)
  return result
}

/**
 * Fetches an exchange offer by id. Returns null if not found.
 * @deprecated Prefer ensureOfferExists which throws on missing.
 */
export async function findOfferById(db: AppDatabase, id: string): Promise<ExchangeOffer | null> {
  const [offer] = await db.select().from(exchange_offers).where(eq(exchange_offers.id, id)).limit(1)
  return offer ?? null
}

/**
 * Given an already-fetched offer row, loads all relations and returns a full
 * ExchangeOfferDetail. Applies payment-account visibility rules based on viewerId.
 * Strips resolver_wallet_address from dispute before returning.
 */
export async function buildOfferDetail(
  db: AppDatabase,
  offer: ExchangeOffer,
  viewerId: string,
): Promise<ExchangeOfferDetail> {
  const userIds = offer.buyer_id
    ? [offer.seller_id, offer.buyer_id]
    : [offer.seller_id]

  const [userRows, proofs, disputeRows, allAccounts] = await Promise.all([
    db.select(USER_COLS).from(users).where(inArray(users.id, userIds)),
    db.select().from(exchange_proofs).where(eq(exchange_proofs.offer_id, offer.id)),
    db.select().from(exchange_disputes).where(eq(exchange_disputes.offer_id, offer.id)).limit(1),
    offer.payment_account_ids.length > 0
      ? db
          .select()
          .from(user_exchange_accounts)
          .where(and(
            inArray(user_exchange_accounts.id, offer.payment_account_ids),
            eq(user_exchange_accounts.is_active, true),
          ))
      : Promise.resolve([]),
  ])

  const userMap = new Map(userRows.map((u) => [u.id, u]))

  const isSeller = viewerId === offer.seller_id
  const isBuyer  = viewerId === offer.buyer_id
  const paymentAccounts = isSeller || (isBuyer && offer.status !== 'open') ? allAccounts : []

  const rawDispute = disputeRows[0] ?? null
  const dispute = rawDispute
    ? (({ resolver_wallet_address, ...rest }) => rest)(rawDispute)
    : null

  return {
    ...offer,
    seller:           userMap.get(offer.seller_id)!,
    buyer:            offer.buyer_id ? (userMap.get(offer.buyer_id) ?? null) : null,
    payment_accounts: paymentAccounts,
    proofs,
    dispute,
  } as ExchangeOfferDetail
}

// Throttle batch expiry writes to at most once per minute so a busy list
// endpoint doesn't issue a DB write on every single request.
let lastBatchExpiry = 0
const BATCH_EXPIRY_COOLDOWN_MS = 60_000

/**
 * Lazily expire a single exchange offer if its deadlines have passed.
 * Called on GET /v1/exchange/:id to keep the single-record view accurate.
 *
 * Condition 1: open offer whose accept_deadline has passed → expired
 * Condition 2: accepted offer where accepted_at + payment_window_seconds + 86400 (grace) has passed → expired
 */
export async function checkAndExpireOffer(offer: ExchangeOffer, db: AppDatabase): Promise<ExchangeOffer> {
  const now = new Date()

  // Open offer whose accept deadline has passed
  if (offer.status === 'open' && offer.accept_deadline && now > new Date(offer.accept_deadline)) {
    const [updated] = await db
      .update(exchange_offers)
      .set({ status: 'expired', updated_at: now })
      .where(and(eq(exchange_offers.id, offer.id), eq(exchange_offers.status, 'open')))
      .returning()
    return updated ?? offer
  }

  // Accepted offer whose payment window + grace period have both passed
  if (offer.status === 'accepted' && offer.accepted_at) {
    const cutoff = new Date(
      new Date(offer.accepted_at).getTime() + (offer.payment_window_seconds + 86400) * 1000,
    )
    if (now > cutoff) {
      const [updated] = await db
        .update(exchange_offers)
        .set({ status: 'expired', updated_at: now })
        .where(and(eq(exchange_offers.id, offer.id), eq(exchange_offers.status, 'accepted')))
        .returning()
      return updated ?? offer
    }
  }

  return offer
}

export interface BatchExpireLogger {
  info(obj: object, msg: string): void
  error(obj: object, msg: string): void
}

/**
 * Batch-expire exchange offers whose deadlines have passed.
 * Throttled to run at most once per minute across all requests.
 * Called at the start of GET /v1/exchange so the list never serves stale statuses.
 *
 * @todo Replace with a scheduled cron job when traffic warrants it.
 */
export async function batchExpireOffers(db: AppDatabase, log: BatchExpireLogger): Promise<void> {
  const now = Date.now()
  if (now - lastBatchExpiry < BATCH_EXPIRY_COOLDOWN_MS) return
  lastBatchExpiry = now

  const nowDate = new Date()

  try {
    // 1. Open offers whose accept deadline has passed
    const expired1 = await db
      .update(exchange_offers)
      .set({ status: 'expired', updated_at: nowDate })
      .where(
        and(
          eq(exchange_offers.status, 'open'),
          isNotNull(exchange_offers.accept_deadline),
          sql`${exchange_offers.accept_deadline} < NOW()`,
        ),
      )
      .returning({ id: exchange_offers.id })

    // 2. Accepted offers where accepted_at + payment_window_seconds + 86400 (grace period) have passed.
    // make_interval(secs => n) converts an integer seconds value to a Postgres interval.
    const expired2 = await db
      .update(exchange_offers)
      .set({ status: 'expired', updated_at: nowDate })
      .where(
        and(
          eq(exchange_offers.status, 'accepted'),
          isNotNull(exchange_offers.accepted_at),
          sql`${exchange_offers.accepted_at} + make_interval(secs => ${exchange_offers.payment_window_seconds} + 86400) < NOW()`,
        ),
      )
      .returning({ id: exchange_offers.id })

    const total = expired1.length + expired2.length
    if (total > 0) {
      log.info({ expiredOpen: expired1.length, expiredAccepted: expired2.length }, `batchExpireOffers: expired ${total} offer(s)`)
    }
  } catch (err) {
    log.error({ err }, 'batchExpireOffers: UPDATE failed')
  }
}
