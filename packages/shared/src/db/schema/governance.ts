import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
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
  winner: disputeWinnerEnum('winner'),
  resolved_by: uuid('resolved_by').references(() => users.id, { onDelete: 'restrict' }),
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

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
