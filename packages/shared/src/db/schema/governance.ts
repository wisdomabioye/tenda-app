import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { escrows } from './escrow'
import { users } from './identity'

export const disputeWinnerEnum = pgEnum('dispute_winner', [
  'creator',
  'counterparty',
  'split',
])

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  escrow_id: uuid('escrow_id')
    .notNull()
    .unique('disputes_escrow_id_uq')
    .references(() => escrows.id, { onDelete: 'cascade' }),
  raised_by: uuid('raised_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  reason: text('reason').notNull(),
  // CO7 claim-based mediation: an admin claims a dispute from the open
  // pool (POST /admin/disputes/:id/claim) before mediating in its thread.
  // Null = unclaimed. Cleared by release; survives resolution for audit.
  assigned_to: uuid('assigned_to').references(() => users.id, { onDelete: 'restrict' }),
  assigned_at: timestamp('assigned_at'),
  winner: disputeWinnerEnum('winner'),
  resolved_by: uuid('resolved_by').references(() => users.id, { onDelete: 'restrict' }),
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

/**
 * CO7 mediation thread: ONE shared conversation per dispute — both escrow
 * parties and the mediating admin read/write the same messages (no
 * per-pair side channels). Thread goes read-only once the dispute is
 * resolved.
 */
export const dispute_messages = pgTable(
  'dispute_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dispute_id: uuid('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),
    sender_id: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: varchar('body', { length: 2000 }).notNull(),
    // precision 3 (ms): the client's ?after cursor is this value round-
    // tripped through toISOString(), which carries milliseconds only —
    // µs-precision storage would re-include boundary rows on every poll.
    created_at: timestamp('created_at', { precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index('dispute_messages_dispute_idx').on(t.dispute_id, t.created_at)],
)

/** Per-participant last-read pointer for a dispute thread (CO7). */
export const dispute_reads = pgTable(
  'dispute_reads',
  {
    dispute_id: uuid('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    last_read_at: timestamp('last_read_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dispute_id, t.user_id] })],
)

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    escrow_id: uuid('escrow_id')
      .notNull()
      .references(() => escrows.id, { onDelete: 'cascade' }),
    reviewer_id: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewee_id: uuid('reviewee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    score: integer('score').notNull(),
    comment: text('comment'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('reviews_escrow_reviewer_uq').on(t.escrow_id, t.reviewer_id),
    check('reviews_score_range_chk', sql`${t.score} BETWEEN 1 AND 5`),
    check('reviews_reviewer_not_reviewee_chk', sql`${t.reviewer_id} <> ${t.reviewee_id}`),
  ],
)

// Singleton row enforced by `id = 1` CHECK.
export const platform_config = pgTable(
  'platform_config',
  {
    id: integer('id').primaryKey().default(1),
    fee_bps: integer('fee_bps').notNull().default(250),
    seeker_fee_bps: integer('seeker_fee_bps').notNull().default(100),
    grace_period_seconds: integer('grace_period_seconds').notNull().default(3600),
    approval_window_seconds: integer('approval_window_seconds').notNull().default(172800),
    default_sponsored_tx_count: integer('default_sponsored_tx_count').notNull().default(3),
    moderation_rules_version: integer('moderation_rules_version').notNull().default(1),
  },
  (t) => [
    check('platform_config_singleton_chk', sql`${t.id} = 1`),
    // Closes open issue D5. 10_000 bps = 100%.
    check(
      'platform_config_fee_bps_range_chk',
      sql`${t.fee_bps} BETWEEN 0 AND 10000 AND ${t.seeker_fee_bps} BETWEEN 0 AND 10000`,
    ),
  ],
)
