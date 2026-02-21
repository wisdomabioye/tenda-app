import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  doublePrecision,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ── Enums ─────────────────────────────────────────────────────────────

export const gigStatusEnum = pgEnum('gig_status', [
  'draft',
  'open',
  'accepted',
  'submitted',
  'completed',
  'disputed',
  'resolved',
  'expired',    // deadline passed without completion — distinct from cancelled
  'cancelled',  // voluntarily cancelled by poster
])

export const gigCategoryEnum = pgEnum('gig_category', [
  'delivery',
  'photo',
  'errand',
  'service',
  'digital',
])

export const disputeWinnerEnum = pgEnum('dispute_winner', [
  'worker',
  'poster',
  'split',
])

export const gigTransactionTypeEnum = pgEnum('gig_transaction_type', [
  'create_escrow',    // poster funds escrow on publish (draft → open)
  'release_payment',  // payment released to worker on completion
  'cancel_refund',    // poster voluntarily cancels an open gig
  'expired_refund',   // gig expired (accept or completion deadline passed)
  'dispute_resolved', // admin resolves dispute — see disputes.winner for breakdown
])

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended'])

export const proofTypeEnum = pgEnum('proof_type', ['image', 'video', 'document'])

// ── Tables ────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:               uuid('id').primaryKey().defaultRandom(),
  wallet_address:   text('wallet_address').unique().notNull(),
  first_name:       text('first_name'),
  last_name:        text('last_name'),
  avatar_url:       text('avatar_url'),
  bio:              text('bio'),
  city:             text('city'),
  latitude:         doublePrecision('latitude'),
  longitude:        doublePrecision('longitude'),
  reputation_score: integer('reputation_score').default(0),
  role:             userRoleEnum('role').default('user').notNull(),
  status:           userStatusEnum('status').default('active').notNull(),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  status_idx: index('users_status_idx').on(t.status),
}))

export const gigs = pgTable('gigs', {
  id:        uuid('id').primaryKey().defaultRandom(),
  poster_id: uuid('poster_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  worker_id: uuid('worker_id').references(() => users.id),

  title:       varchar('title', { length: 200 }).notNull(),
  description: varchar('description', { length: 5000 }).notNull(),

  // All monetary values in lamports (1 SOL = 1,000,000,000 lamports).
  // Use bigint to match the contract's u64 — never store lamports in integer.
  // Convert to SOL or display currency at the application layer.
  payment_lamports: bigint('payment_lamports', { mode: 'number' }).notNull(),

  category: gigCategoryEnum('category').notNull(),
  status:   gigStatusEnum('status').default('draft').notNull(),

  // Location — nullable: digital gigs have no physical location
  city:      text('city').notNull(),
  address:   text('address'),
  latitude:  doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),

  // Deadlines
  // accept_deadline:           optional hard cutoff for worker acceptance (null = indefinitely open)
  // completion_duration_seconds: how long the worker has after accepting
  // completion_deadline:       NOT stored — compute as: accepted_at + completion_duration_seconds
  accept_deadline:             timestamp('accept_deadline', { withTimezone: true }),
  completion_duration_seconds: integer('completion_duration_seconds').notNull(),
  accepted_at:                 timestamp('accepted_at', { withTimezone: true }),

  // Escrow — address of the on-chain PDA for this gig
  escrow_address: text('escrow_address'),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  // Note: add a Postgres trigger on migration to auto-update updated_at on every UPDATE
}, (t) => ({
  poster_idx:         index('gigs_poster_id_idx').on(t.poster_id),
  worker_idx:         index('gigs_worker_id_idx').on(t.worker_id),
  status_idx:         index('gigs_status_idx').on(t.status),
  category_idx:       index('gigs_category_idx').on(t.category),
  city_idx:           index('gigs_city_idx').on(t.city),
  status_city_idx:    index('gigs_status_city_idx').on(t.status, t.city),
  created_at_idx:     index('gigs_created_at_idx').on(t.created_at),
  escrow_address_idx: uniqueIndex('gigs_escrow_address_unique').on(t.escrow_address),
}))

export const gig_proofs = pgTable('gig_proofs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  gig_id:         uuid('gig_id')
    .references(() => gigs.id, { onDelete: 'cascade' })
    .notNull(),
  uploaded_by_id: uuid('uploaded_by_id')
    .references(() => users.id)
    .notNull(),
  url:        text('url').notNull(),
  type:       proofTypeEnum('type').default('image').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  gig_idx: index('gig_proofs_gig_id_idx').on(t.gig_id),
}))

export const gig_transactions = pgTable('gig_transactions', {
  id:     uuid('id').primaryKey().defaultRandom(),
  gig_id: uuid('gig_id')
    .references(() => gigs.id, { onDelete: 'cascade' })
    .notNull(),
  type:                    gigTransactionTypeEnum('type').notNull(),
  signature:               text('signature').notNull(), // on-chain transaction signature
  amount_lamports:         bigint('amount_lamports', { mode: 'number' }).notNull(),
  platform_fee_lamports:   bigint('platform_fee_lamports', { mode: 'number' }).notNull(),
  created_at:              timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  gig_idx:          index('gig_transactions_gig_id_idx').on(t.gig_id),
  // Prevent duplicate on-chain signature records from client retries
  signature_unique: uniqueIndex('gig_transactions_signature_unique').on(t.signature),
}))

export const disputes = pgTable('disputes', {
  id:          uuid('id').primaryKey().defaultRandom(),
  gig_id:      uuid('gig_id')
    .references(() => gigs.id, { onDelete: 'cascade' })
    .notNull(),
  raised_by_id: uuid('raised_by_id')
    .references(() => users.id)
    .notNull(),
  // resolver is a platform admin — stored as wallet address for flexibility,
  // not a FK since admins may not have a users row
  resolver_wallet_address: text('resolver_wallet_address'),
  reason:      varchar('reason', { length: 2000 }).notNull(),
  winner:      disputeWinnerEnum('winner'),
  raised_at:   timestamp('raised_at', { withTimezone: true }).defaultNow().notNull(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  // One active dispute per gig enforced at DB level
  gig_unique:   uniqueIndex('disputes_gig_id_unique').on(t.gig_id),
  resolved_idx: index('disputes_resolved_at_idx').on(t.resolved_at),
}))

export const reviews = pgTable('reviews', {
  id:          uuid('id').primaryKey().defaultRandom(),
  gig_id:      uuid('gig_id')
    .references(() => gigs.id, { onDelete: 'cascade' })
    .notNull(),
  reviewer_id: uuid('reviewer_id')
    .references(() => users.id)
    .notNull(),
  reviewee_id: uuid('reviewee_id')
    .references(() => users.id)
    .notNull(),
  score:       integer('score').notNull(),           // 1–5
  comment:     varchar('comment', { length: 1000 }),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  unique_review: uniqueIndex('reviews_gig_reviewer_unique').on(t.gig_id, t.reviewer_id),
  reviewee_idx:  index('reviews_reviewee_id_idx').on(t.reviewee_id),
}))

export const platform_config = pgTable('platform_config', {
  id:                   integer('id').primaryKey().default(1), // single-row table
  fee_bps:              integer('fee_bps').default(250).notNull(),
  grace_period_seconds: integer('grace_period_seconds').default(86400).notNull(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
