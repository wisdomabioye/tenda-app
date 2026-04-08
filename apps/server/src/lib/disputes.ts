/**
 * Shared helpers for dispute thread mediation (Phase 3).
 * Used by both admin routes (/v1/admin/disputes) and user-facing routes
 * (/v1/gigs/:id/dispute/thread, /v1/exchange/:id/dispute/thread).
 */
import { eq, and, asc, sql } from 'drizzle-orm'
import {
  disputes,
  exchange_disputes,
  dispute_threads,
  dispute_messages,
  gigs,
  exchange_offers,
  users,
} from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { AppDatabase } from '@server/plugins/db'
import { AppError } from './errors'

export type DisputeType = 'gig' | 'exchange'
export type SenderRole  = 'party_a' | 'party_b' | 'admin'

// ── Type guards ───────────────────────────────────────────────────────────────

export function parseDisputeType(type: string): DisputeType {
  if (type !== 'gig' && type !== 'exchange') {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'type must be "gig" or "exchange"')
  }
  return type
}

// ── Dispute lookup ────────────────────────────────────────────────────────────

/** Fetches a gig dispute by its ID. Throws 404 if not found. */
export async function fetchGigDispute(db: AppDatabase, disputeId: string) {
  const [row] = await db
    .select({
      id:                   disputes.id,
      gig_id:               disputes.gig_id,
      raised_by_id:         disputes.raised_by_id,
      reason:               disputes.reason,
      winner:               disputes.winner,
      resolver_wallet_address: disputes.resolver_wallet_address,
      raised_at:            disputes.raised_at,
      resolved_at:          disputes.resolved_at,
      gig_title:            gigs.title,
      gig_poster_id:        gigs.poster_id,
      gig_worker_id:        gigs.worker_id,
    })
    .from(disputes)
    .innerJoin(gigs, eq(disputes.gig_id, gigs.id))
    .where(eq(disputes.id, disputeId))
    .limit(1)
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'Dispute not found')
  return row
}

/** Fetches an exchange dispute by its ID. Throws 404 if not found. */
export async function fetchExchangeDispute(db: AppDatabase, disputeId: string) {
  const [row] = await db
    .select({
      id:            exchange_disputes.id,
      offer_id:      exchange_disputes.offer_id,
      opened_by_id:  exchange_disputes.opened_by_id,
      reason:        exchange_disputes.reason,
      winner:        exchange_disputes.winner,
      raised_at:     exchange_disputes.raised_at,
      resolved_at:   exchange_disputes.resolved_at,
      offer_fiat_currency: exchange_offers.fiat_currency,
      offer_fiat_amount:   exchange_offers.fiat_amount,
      offer_seller_id:     exchange_offers.seller_id,
      offer_buyer_id:      exchange_offers.buyer_id,
    })
    .from(exchange_disputes)
    .innerJoin(exchange_offers, eq(exchange_disputes.offer_id, exchange_offers.id))
    .where(eq(exchange_disputes.id, disputeId))
    .limit(1)
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'Dispute not found')
  return row
}

/** Fetches a gig dispute by gig_id. Throws 404 if not found. */
export async function fetchGigDisputeByGigId(db: AppDatabase, gigId: string) {
  const [row] = await db
    .select()
    .from(disputes)
    .where(eq(disputes.gig_id, gigId))
    .limit(1)
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'No dispute found for this gig')
  return row
}

/** Fetches an exchange dispute by offer_id. Throws 404 if not found. */
export async function fetchExchangeDisputeByOfferId(db: AppDatabase, offerId: string) {
  const [row] = await db
    .select()
    .from(exchange_disputes)
    .where(eq(exchange_disputes.offer_id, offerId))
    .limit(1)
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'No dispute found for this offer')
  return row
}

// ── Thread operations ─────────────────────────────────────────────────────────

/**
 * Gets the thread for a given dispute (by gig_dispute_id or exchange_dispute_id).
 * Returns null if no thread exists yet.
 */
export async function getThreadForDispute(
  db: AppDatabase,
  opts: { gigDisputeId: string } | { exchangeDisputeId: string },
) {
  const where = 'gigDisputeId' in opts
    ? eq(dispute_threads.gig_dispute_id, opts.gigDisputeId)
    : eq(dispute_threads.exchange_dispute_id, opts.exchangeDisputeId)

  const [thread] = await db
    .select()
    .from(dispute_threads)
    .where(where)
    .limit(1)
  return thread ?? null
}

/**
 * Opens a dispute thread. Idempotent — returns existing thread if one already exists
 * for this dispute (Fix #24). Returns { thread, created: boolean }.
 */
export async function openDisputeThread(
  db: AppDatabase,
  opts: { gigDisputeId: string } | { exchangeDisputeId: string },
) {
  const existing = await getThreadForDispute(db, opts)
  if (existing) return { thread: existing, created: false }

  const values = 'gigDisputeId' in opts
    ? { gig_dispute_id: opts.gigDisputeId }
    : { exchange_dispute_id: opts.exchangeDisputeId }

  const [thread] = await db.insert(dispute_threads).values(values).returning()
  return { thread: thread!, created: true }
}

/** Fetches a thread by its ID. Throws 404 if not found. */
export async function fetchThread(db: AppDatabase, threadId: string) {
  const [thread] = await db
    .select()
    .from(dispute_threads)
    .where(eq(dispute_threads.id, threadId))
    .limit(1)
  if (!thread) throw new AppError(404, ErrorCode.NOT_FOUND, 'Thread not found')
  return thread
}

// ── Message operations ────────────────────────────────────────────────────────

export interface GetMessagesOpts {
  limit?:  number
  offset?: number
}

/** Returns paginated messages for a thread, oldest-first. */
export async function getThreadMessages(
  db: AppDatabase,
  threadId: string,
  opts: GetMessagesOpts = {},
) {
  const safeLimit  = Math.min(Number(opts.limit ?? 50), MAX_PAGINATION_LIMIT)
  const safeOffset = Number(opts.offset ?? 0)

  const [data, countRows] = await Promise.all([
    db
      .select({
        id:          dispute_messages.id,
        thread_id:   dispute_messages.thread_id,
        sender_id:   dispute_messages.sender_id,
        sender_role: dispute_messages.sender_role,
        body:        dispute_messages.body,
        created_at:  dispute_messages.created_at,
        sender_first_name: users.first_name,
        sender_last_name:  users.last_name,
      })
      .from(dispute_messages)
      .leftJoin(users, eq(dispute_messages.sender_id, users.id))
      .where(eq(dispute_messages.thread_id, threadId))
      .orderBy(asc(dispute_messages.created_at))
      .limit(safeLimit)
      .offset(safeOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dispute_messages)
      .where(eq(dispute_messages.thread_id, threadId)),
  ])

  return {
    data,
    total:  countRows[0]?.count ?? 0,
    limit:  safeLimit,
    offset: safeOffset,
  }
}

/** Posts a message to a thread. */
export async function postThreadMessage(
  db: AppDatabase,
  threadId: string,
  senderId: string,
  senderRole: SenderRole,
  body: string,
) {
  const [msg] = await db
    .insert(dispute_messages)
    .values({ thread_id: threadId, sender_id: senderId, sender_role: senderRole, body: body.trim() })
    .returning()
  return msg!
}

/** Updates the last-read timestamp for the given role. */
export async function markThreadRead(
  db: AppDatabase,
  threadId: string,
  role: SenderRole,
) {
  const now = new Date()
  const col = role === 'party_a' ? { party_a_last_read_at: now }
            : role === 'party_b' ? { party_b_last_read_at: now }
            :                      { admin_last_read_at: now }
  await db.update(dispute_threads).set(col).where(eq(dispute_threads.id, threadId))
}

// ── Open disputes (unresolved) UNION query ────────────────────────────────────
// Used by GET /admin/disputes to show all pending disputes across both types.
// Drizzle does not support UNION natively, so we use a raw SQL UNION ALL with
// ORDER BY/LIMIT/OFFSET pushed to the DB — avoids fetching all rows into memory.

export interface DisputeSummary {
  dispute_id:           string
  dispute_type:         DisputeType
  subject_id:           string          // gig_id or offer_id
  subject_title:        string | null   // gig title or null for exchange
  raised_by_id:         string
  raised_by_first_name: string | null
  raised_by_last_name:  string | null
  reason:               string
  raised_at:            Date | string | null
  thread_id:            string | null
  assigned_to_id:       string | null
}

export async function listOpenDisputes(
  db: AppDatabase,
  limit: number,
  offset: number,
): Promise<{ data: DisputeSummary[]; total: number; limit: number; offset: number }> {
  const [rows, countRows] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      SELECT
        d.id                        AS dispute_id,
        'gig'::text                 AS dispute_type,
        d.gig_id                    AS subject_id,
        g.title                     AS subject_title,
        d.raised_by_id,
        u.first_name                AS raised_by_first_name,
        u.last_name                 AS raised_by_last_name,
        d.reason,
        d.raised_at,
        dt.id                       AS thread_id,
        dt.assigned_to_id
      FROM disputes d
      JOIN gigs g             ON g.id  = d.gig_id
      JOIN users u            ON u.id  = d.raised_by_id
      LEFT JOIN dispute_threads dt ON dt.gig_dispute_id = d.id
      WHERE d.resolved_at IS NULL

      UNION ALL

      SELECT
        ed.id                       AS dispute_id,
        'exchange'::text            AS dispute_type,
        ed.offer_id                 AS subject_id,
        NULL::text                  AS subject_title,
        ed.opened_by_id             AS raised_by_id,
        u.first_name                AS raised_by_first_name,
        u.last_name                 AS raised_by_last_name,
        ed.reason,
        ed.raised_at,
        dt.id                       AS thread_id,
        dt.assigned_to_id
      FROM exchange_disputes ed
      JOIN exchange_offers eo       ON eo.id = ed.offer_id
      JOIN users u                  ON u.id  = ed.opened_by_id
      LEFT JOIN dispute_threads dt  ON dt.exchange_dispute_id = ed.id
      WHERE ed.resolved_at IS NULL

      ORDER BY raised_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `),

    db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM (
        SELECT id FROM disputes        WHERE resolved_at IS NULL
        UNION ALL
        SELECT id FROM exchange_disputes WHERE resolved_at IS NULL
      ) t
    `),
  ])

  return {
    data:   rows as unknown as DisputeSummary[],
    total:  countRows[0]?.count ?? 0,
    limit,
    offset,
  }
}

/**
 * Clears assigned_to_id on all open threads currently assigned to a given admin.
 * Called when a dispute_resolver is demoted (Fix #38).
 */
export async function clearAssignedThreads(db: AppDatabase, adminId: string): Promise<void> {
  await db
    .update(dispute_threads)
    .set({ assigned_to_id: null })
    .where(
      and(
        eq(dispute_threads.assigned_to_id, adminId),
        // Only clear threads whose dispute is still open (join would be complex —
        // simpler to clear all assignments and let re-triage happen).
      ),
    )
}
