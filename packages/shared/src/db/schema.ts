import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  doublePrecision,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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
  'accept_gig',       // worker accepts gig on-chain (open → accepted)
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
  country:          text('country'),
  city:             text('city'),
  latitude:         doublePrecision('latitude'),
  longitude:        doublePrecision('longitude'),
  reputation_score: integer('reputation_score').default(0),
  role:             userRoleEnum('role').default('user').notNull(),
  status:           userStatusEnum('status').default('active').notNull(),
  is_seeker:        boolean('is_seeker').notNull().default(false),
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

  // Location — city/address nullable for remote gigs; country always set
  country:      text('country').notNull().default('NG'),
  cross_border: boolean('cross_border').notNull().default(false),
  remote:       boolean('remote').notNull().default(false),
  city:      text('city'),   // nullable: remote gigs have no city
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
  poster_idx:              index('gigs_poster_id_idx').on(t.poster_id),
  worker_idx:              index('gigs_worker_id_idx').on(t.worker_id),
  status_idx:              index('gigs_status_idx').on(t.status),
  category_idx:            index('gigs_category_idx').on(t.category),
  country_idx:             index('gigs_country_idx').on(t.country),
  remote_idx:              index('gigs_remote_idx').on(t.remote),
  city_idx:                index('gigs_city_idx').on(t.city),
  status_city_idx:         index('gigs_status_city_idx').on(t.status, t.city),
  status_country_idx:      index('gigs_status_country_idx').on(t.status, t.country),
  status_remote_idx:       index('gigs_status_remote_idx').on(t.status, t.remote),
  created_at_idx:          index('gigs_created_at_idx').on(t.created_at),
  // Speeds up lazy-expiry batch scan: open gigs WHERE accept_deadline < now
  accept_deadline_idx:     index('gigs_accept_deadline_idx').on(t.accept_deadline),
  escrow_address_idx:      uniqueIndex('gigs_escrow_address_unique').on(t.escrow_address),
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
  seeker_fee_bps:       integer('seeker_fee_bps').default(100).notNull(),
  grace_period_seconds: integer('grace_period_seconds').default(86400).notNull(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Chat & Notifications ───────────────────────────────────────────────────

export const conversationStatusEnum = pgEnum('conversation_status', ['active', 'closed'])

/** We will use fcm/apns in the future - open_issues #84 */
export const devicePlatformEnum = pgEnum('device_platform', ['expo', 'fcm', 'apns'])

export const conversations = pgTable('conversations', {
  id:              uuid('id').primaryKey().defaultRandom(),
  // Canonical order: user_a_id < user_b_id (enforced in application layer)
  user_a_id:       uuid('user_a_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  user_b_id:       uuid('user_b_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status:          conversationStatusEnum('status').default('active').notNull(),
  closed_by:       uuid('closed_by').references(() => users.id),
  closed_at:       timestamp('closed_at', { withTimezone: true }),
  last_message_at: timestamp('last_message_at', { withTimezone: true }),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  user_pair_unique: uniqueIndex('conversations_user_pair_unique').on(t.user_a_id, t.user_b_id),
  user_a_idx:       index('conversations_user_a_idx').on(t.user_a_id),
  user_b_idx:       index('conversations_user_b_idx').on(t.user_b_id),
}))

export const messages = pgTable('messages', {
  id:              uuid('id').primaryKey().defaultRandom(),
  conversation_id: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  sender_id:  uuid('sender_id').references(() => users.id).notNull(),
  gig_id:     uuid('gig_id').references(() => gigs.id, { onDelete: 'set null' }),
  content:    varchar('content', { length: 2000 }).notNull(),
  read_at:    timestamp('read_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // Composite index covers the paginated history query:
  // WHERE conversation_id = X ORDER BY created_at DESC [LIMIT n]
  conversation_created_at_idx: index('messages_conversation_created_at_idx').on(t.conversation_id, t.created_at),
  sender_idx:                  index('messages_sender_id_idx').on(t.sender_id),
  // Partial index for unread-count queries and mark-as-read UPDATE
  unread_idx: index('messages_unread_idx').on(t.conversation_id, t.sender_id).where(sql`read_at IS NULL`),
}))

export const device_tokens = pgTable('device_tokens', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token:      text('token').notNull(),
  platform:   devicePlatformEnum('platform').default('expo').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  token_unique: uniqueIndex('device_tokens_token_unique').on(t.token),
  user_idx:     index('device_tokens_user_id_idx').on(t.user_id),
}))

export const reportContentTypeEnum = pgEnum('report_content_type', ['gig', 'message', 'user', 'review'])
export const reportReasonEnum      = pgEnum('report_reason',       ['spam', 'harassment', 'inappropriate', 'fraud', 'other'])
export const reportStatusEnum      = pgEnum('report_status',       ['pending', 'reviewed', 'actioned', 'dismissed'])

export const blocked_keywords = pgTable('blocked_keywords', {
  id:         uuid('id').primaryKey().defaultRandom(),
  keyword:    varchar('keyword', { length: 200 }).notNull(),
  // added_by: audit trail — which admin added this keyword (issue: moderation #19)
  added_by:   uuid('added_by').references(() => users.id).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  keyword_unique: uniqueIndex('blocked_keywords_keyword_unique').on(t.keyword),
}))

export const reports = pgTable('reports', {
  id:               uuid('id').primaryKey().defaultRandom(),
  reporter_id:      uuid('reporter_id').references(() => users.id).notNull(),
  // reported_user_id: derived server-side from content_type + content_id — never trusted from client
  reported_user_id: uuid('reported_user_id').references(() => users.id).notNull(),
  content_type:     reportContentTypeEnum('content_type').notNull(),
  content_id:       uuid('content_id').notNull(),
  reason:           reportReasonEnum('reason').notNull(),
  note:             varchar('note', { length: 500 }),             // optional context from reporter
  content_snapshot: varchar('content_snapshot', { length: 2000 }), // text at time of report for offline review
  status:           reportStatusEnum('status').default('pending').notNull(),
  admin_note:       varchar('admin_note', { length: 1000 }),
  reviewed_at:      timestamp('reviewed_at', { withTimezone: true }),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // One report per user per piece of content — prevents spam reports and is naturally idempotent
  reporter_content_unique: uniqueIndex('reports_reporter_content_unique').on(t.reporter_id, t.content_type, t.content_id),
  // Admin review queue indexes
  status_idx:              index('reports_status_idx').on(t.status),
  content_type_status_idx: index('reports_content_type_status_idx').on(t.content_type, t.status),
  content_id_idx:          index('reports_content_id_idx').on(t.content_id),
  reported_user_idx:       index('reports_reported_user_id_idx').on(t.reported_user_id),
}))

export const gig_subscriptions = pgTable('gig_subscriptions', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  // '*' means any city/category (sentinel instead of NULL to enable UNIQUE constraint)
  city:       text('city').default('*').notNull(),
  category:   text('category').default('*').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  user_city_cat_unique: uniqueIndex('gig_subscriptions_unique').on(t.user_id, t.city, t.category),
  user_idx:             index('gig_subscriptions_user_id_idx').on(t.user_id),
  // Covers the fan-out query: WHERE city IN (data.city, '*') — filters by city first,
  // then category, avoiding a full-table scan as subscriber count grows.
  city_category_idx:    index('gig_subscriptions_city_category_idx').on(t.city, t.category),
}))

// ── P2P Exchange ──────────────────────────────────────────────────────────────

export const exchangeOfferStatusEnum = pgEnum('exchange_offer_status', [
  'draft',
  'open',
  'accepted',
  'paid',
  'completed',
  'disputed',
  'resolved',
  'cancelled',
  'expired',
])

export const exchangeTransactionTypeEnum = pgEnum('exchange_transaction_type', [
  'create_escrow',
  'accept',
  'mark_paid',       // buyer submits fiat-payment proof on-chain (submit_proof instruction)
  'release_payment',
  'cancel_refund',
  'expired_refund',
  'dispute_raised',
  'dispute_resolved',
])

export const exchangeDisputeWinnerEnum = pgEnum('exchange_dispute_winner', [
  'seller',
  'buyer',
  'split',
])

export const exchange_offers = pgTable('exchange_offers', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  seller_id:              uuid('seller_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  buyer_id:               uuid('buyer_id').references(() => users.id),
  lamports_amount:        bigint('lamports_amount', { mode: 'bigint' }).notNull(),  // SOL amount in lamports
  fiat_amount:            integer('fiat_amount').notNull(),                          // major currency units (e.g. whole NGN)
  fiat_currency:          varchar('fiat_currency', { length: 3 }).notNull(),        // ISO 4217
  rate:                   doublePrecision('rate').notNull(),                         // fiat per SOL at creation (informational)
  payment_window_seconds: integer('payment_window_seconds').notNull().default(86400), // buyer must pay within N seconds of accepting
  payment_account_ids:    uuid('payment_account_ids').array().notNull().default([]), // seller's chosen user_exchange_accounts
  status:                 exchangeOfferStatusEnum('status').default('draft').notNull(),
  accept_deadline:        timestamp('accept_deadline', { withTimezone: true }),     // null = indefinitely open
  accepted_at:            timestamp('accepted_at', { withTimezone: true }),
  paid_at:                timestamp('paid_at', { withTimezone: true }),
  completed_at:           timestamp('completed_at', { withTimezone: true }),
  escrow_address:         text('escrow_address'),
  created_at:             timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:             timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  seller_idx:           index('exchange_offers_seller_id_idx').on(t.seller_id),
  buyer_idx:            index('exchange_offers_buyer_id_idx').on(t.buyer_id),
  status_idx:           index('exchange_offers_status_idx').on(t.status),
  currency_idx:         index('exchange_offers_currency_idx').on(t.fiat_currency),
  status_curr_idx:      index('exchange_offers_status_currency_idx').on(t.status, t.fiat_currency),
  // Covers min_lamports / max_lamports range filters on the market list endpoint
  status_lamports_idx:  index('exchange_offers_status_lamports_idx').on(t.status, t.lamports_amount),
  deadline_idx:         index('exchange_offers_accept_deadline_idx').on(t.accept_deadline),
  escrow_unique:        uniqueIndex('exchange_offers_escrow_unique').on(t.escrow_address),
}))

// Seller's reusable payment accounts. Selected per-offer via payment_account_ids.
export const user_exchange_accounts = pgTable('user_exchange_accounts', {
  id:              uuid('id').primaryKey().defaultRandom(),
  user_id:         uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  method:          varchar('method', { length: 100 }).notNull(),           // free text: "Bank Transfer", "Mobile Money", etc.
  account_name:    varchar('account_name', { length: 100 }).notNull(),
  account_number:  varchar('account_number', { length: 100 }).notNull(),
  bank_name:       varchar('bank_name', { length: 100 }),
  additional_info: text('additional_info'),
  is_active:       boolean('is_active').notNull().default(true),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  user_idx:       index('user_exchange_accounts_user_id_idx').on(t.user_id),
  active_idx:     index('user_exchange_accounts_active_idx').on(t.user_id, t.is_active),
  unique_account: uniqueIndex('user_exchange_accounts_unique_method_number').on(t.user_id, t.method, t.account_number),
}))

// Fiat payment proof uploaded by buyer when marking offer as paid.
export const exchange_proofs = pgTable('exchange_proofs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  offer_id:       uuid('offer_id').references(() => exchange_offers.id, { onDelete: 'cascade' }).notNull(),
  uploaded_by_id: uuid('uploaded_by_id').references(() => users.id).notNull(),
  url:            text('url').notNull(),
  type:           proofTypeEnum('type').default('image').notNull(),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  offer_idx: index('exchange_proofs_offer_id_idx').on(t.offer_id),
}))

export const exchange_transactions = pgTable('exchange_transactions', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  offer_id:              uuid('offer_id').references(() => exchange_offers.id, { onDelete: 'cascade' }).notNull(),
  type:                  exchangeTransactionTypeEnum('type').notNull(),
  signature:             text('signature').notNull(),
  amount_lamports:       bigint('amount_lamports', { mode: 'bigint' }).notNull(),
  platform_fee_lamports: bigint('platform_fee_lamports', { mode: 'bigint' }).notNull().default(0n),
  created_at:            timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  offer_idx:        index('exchange_transactions_offer_id_idx').on(t.offer_id),
  signature_unique: uniqueIndex('exchange_transactions_signature_unique').on(t.signature),
}))

export const exchange_disputes = pgTable('exchange_disputes', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  offer_id:                uuid('offer_id').references(() => exchange_offers.id, { onDelete: 'cascade' }).notNull(),
  opened_by_id:            uuid('opened_by_id').references(() => users.id).notNull(),
  reason:                  varchar('reason', { length: 2000 }).notNull(),
  winner:                  exchangeDisputeWinnerEnum('winner'),
  resolver_wallet_address: text('resolver_wallet_address'),
  admin_note:              text('admin_note'),
  raised_at:               timestamp('raised_at', { withTimezone: true }).defaultNow().notNull(),
  resolved_at:             timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  offer_unique: uniqueIndex('exchange_disputes_offer_id_unique').on(t.offer_id),
  resolved_idx: index('exchange_disputes_resolved_at_idx').on(t.resolved_at),
}))
