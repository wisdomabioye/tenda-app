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
  jsonb,
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

export const userRoleEnum = pgEnum('user_role', [
  'user',
  'super_admin',
  'dispute_resolver',
  'support',
  'moderator',
  'marketing',
  'airdrop',
  'finance',
  // 'admin' kept in DB enum for backward compat — existing rows and in-flight JWTs.
  // Migration: UPDATE users SET role = 'super_admin' WHERE role = 'admin'
  // Remove after one full JWT lifetime (7 days) post-migration.
  'admin',
])

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
  last_active_at:   timestamp('last_active_at', { withTimezone: true }),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  status_idx: index('users_status_idx').on(t.status),
  // text_pattern_ops index for wallet prefix search (LIKE 'prefix%') must be added
  // via raw SQL migration — Drizzle doesn't support custom operator classes:
  // CREATE INDEX users_wallet_prefix_idx ON users (wallet_address text_pattern_ops);
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

  // Admin moderation — hidden gigs are excluded from public feeds but remain accessible
  // to the poster (via /users/:id/gigs) and admins (via /admin/gigs).
  hidden: boolean('hidden').notNull().default(false),

  // Admin marketing — featured gigs are surfaced prominently in the public feed.
  // Marketing and super_admin roles can set this; cleared when a gig is hidden.
  featured: boolean('featured').notNull().default(false),

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
  hidden_idx:              index('gigs_hidden_idx').on(t.hidden),
  featured_idx:            index('gigs_featured_idx').on(t.featured),
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
    .references(() => gigs.id, { onDelete: 'cascade' }),
  offer_id:    uuid('offer_id')
    .references(() => exchange_offers.id, { onDelete: 'cascade' }),
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
  gig_unique_review:   uniqueIndex('reviews_gig_reviewer_unique').on(t.gig_id, t.reviewer_id),
  offer_unique_review: uniqueIndex('reviews_offer_reviewer_unique').on(t.offer_id, t.reviewer_id),
  reviewee_idx:        index('reviews_reviewee_id_idx').on(t.reviewee_id),
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
  // S5.7 (closes open 86): inbox ordering — list a user's conversations
  // newest-message-first without a sort node.
  user_a_last_msg_idx: index('conversations_user_a_last_msg_idx').on(t.user_a_id, t.last_message_at.desc()),
  user_b_last_msg_idx: index('conversations_user_b_last_msg_idx').on(t.user_b_id, t.last_message_at.desc()),
}))

export const messages = pgTable('messages', {
  id:              uuid('id').primaryKey().defaultRandom(),
  conversation_id: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  sender_id:  uuid('sender_id').references(() => users.id).notNull(),
  gig_id:     uuid('gig_id').references(() => gigs.id, { onDelete: 'set null' }),
  offer_id:   uuid('offer_id').references(() => exchange_offers.id, { onDelete: 'set null' }),
  content:    varchar('content', { length: 2000 }).notNull(),
  // S5.2 (closes open #85): optional chat attachment. URL must live under
  // the conversation-scoped Cloudinary folder (validated at send).
  attachment_url:  text('attachment_url'),
  attachment_type: text('attachment_type', { enum: ['image', 'file'] }),
  attachment_size: integer('attachment_size'),
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
  // S5.7 (closes open 87): report queue is sorted newest-first.
  created_at_idx:          index('reports_created_at_idx').on(t.created_at.desc()),
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
  lamports_amount:        bigint('lamports_amount', { mode: 'number' }).notNull(),  // SOL amount in lamports
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
  // Admin moderation — hidden offers are excluded from public feeds.
  hidden:                 boolean('hidden').notNull().default(false),
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
  hidden_idx:           index('exchange_offers_hidden_idx').on(t.hidden),
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
  amount_lamports:       bigint('amount_lamports', { mode: 'number' }).notNull(),
  platform_fee_lamports: bigint('platform_fee_lamports', { mode: 'number' }).notNull().default(sql`0`),
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
  resolver_wallet_address: text('resolver_wallet_address'), // deprecated — use dispute_threads.assigned_to after Phase 3
  admin_note:              text('admin_note'),               // deprecated — use dispute_messages after Phase 3; kept read-only for legacy records
  raised_at:               timestamp('raised_at', { withTimezone: true }).defaultNow().notNull(),
  resolved_at:             timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  offer_unique: uniqueIndex('exchange_disputes_offer_id_unique').on(t.offer_id),
  resolved_idx: index('exchange_disputes_resolved_at_idx').on(t.resolved_at),
}))

// ── Announcements (Phase 4) ────────────────────────────────────────────────────
// Platform-wide notices shown in the mobile app. Managed by marketing / super_admin.

export const announcements = pgTable('announcements', {
  id:           uuid('id').primaryKey().defaultRandom(),
  title:        varchar('title', { length: 200 }).notNull(),
  body:         varchar('body', { length: 2000 }).notNull(),
  // priority: higher = shown first. 0 = normal, 1 = important, 2 = urgent.
  priority:     integer('priority').notNull().default(0),
  is_active:    boolean('is_active').notNull().default(true),
  // published_at: set when first made active (set once, never cleared).
  published_at: timestamp('published_at', { withTimezone: true }),
  // expires_at: null = never expires.
  expires_at:   timestamp('expires_at', { withTimezone: true }),
  created_by:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:   timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // Public feed query: WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY priority DESC
  active_priority_idx: index('announcements_active_priority_idx').on(t.is_active, t.priority),
  expires_at_idx:      index('announcements_expires_at_idx').on(t.expires_at),
}))

// ── Dispute mediation (Phase 3) ────────────────────────────────────────────────
// A dispute_thread is created by an admin when they begin mediating a dispute.
// Exactly one of gig_dispute_id or exchange_dispute_id must be set (enforced app-side).

export const disputeSenderEnum = pgEnum('dispute_sender', ['party_a', 'party_b', 'admin'])

export const dispute_threads = pgTable('dispute_threads', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  // Exactly one of gig_dispute_id / exchange_dispute_id must be non-null.
  // Drizzle-orm doesn't support CHECK constraints — enforced at application layer.
  gig_dispute_id:       uuid('gig_dispute_id').references(() => disputes.id,          { onDelete: 'cascade' }),
  exchange_dispute_id:  uuid('exchange_dispute_id').references(() => exchange_disputes.id, { onDelete: 'cascade' }),
  // The dispute_resolver admin currently assigned to this thread.
  // Nullable: thread exists before assignment; cleared on demote (Fix #38).
  assigned_to_id:       uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
  // Last-read pointers for unread-count logic.
  // party_a = poster (gig) or seller (exchange); party_b = worker (gig) or buyer (exchange).
  party_a_last_read_at: timestamp('party_a_last_read_at', { withTimezone: true }),
  party_b_last_read_at: timestamp('party_b_last_read_at', { withTimezone: true }),
  admin_last_read_at:   timestamp('admin_last_read_at',   { withTimezone: true }),
  created_at:           timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // At most one thread per dispute
  gig_dispute_unique:      uniqueIndex('dispute_threads_gig_dispute_unique').on(t.gig_dispute_id),
  exchange_dispute_unique: uniqueIndex('dispute_threads_exchange_dispute_unique').on(t.exchange_dispute_id),
  assigned_to_idx:         index('dispute_threads_assigned_to_idx').on(t.assigned_to_id),
}))

export const dispute_messages = pgTable('dispute_messages', {
  id:          uuid('id').primaryKey().defaultRandom(),
  thread_id:   uuid('thread_id')
    .references(() => dispute_threads.id, { onDelete: 'cascade' })
    .notNull(),
  // Nullable on delete so audit history survives if the sender's account is removed.
  sender_id:   uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  sender_role: disputeSenderEnum('sender_role').notNull(),
  body:        varchar('body', { length: 2000 }).notNull(),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // Covers paginated message history: WHERE thread_id = X ORDER BY created_at ASC/DESC
  thread_created_at_idx: index('dispute_messages_thread_created_at_idx').on(t.thread_id, t.created_at),
  sender_idx:            index('dispute_messages_sender_id_idx').on(t.sender_id),
}))

// ── Airdrop (Phase 5) ─────────────────────────────────────────────────────────
// Campaign-based gas subsidy airdrop. Recipients are loaded off-chain then
// distributed on-chain in batches via the batch_airdrop_gas_subsidy instruction
// (requires contract redeployment — see programs/tenda-escrow).

export const airdropStatusEnum = pgEnum('airdrop_status', [
  'draft',        // being configured — recipients can still be added/removed
  'approved',     // super_admin signed off — no further edits, ready to distribute
  'in_progress',  // at least one batch confirmed on-chain
  'completed',    // all batches confirmed
  'cancelled',    // abandoned before completion
])

export const airdropRecipientStatusEnum = pgEnum('airdrop_recipient_status', [
  'pending',      // not yet distributed
  'distributed',  // on-chain signature confirmed
  'failed',       // on-chain tx failed for this recipient
  'skipped',      // already_received_airdrop guard triggered on-chain
])

export const airdrop_campaigns = pgTable('airdrop_campaigns', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  name:                  varchar('name', { length: 200 }).notNull(),
  description:           varchar('description', { length: 1000 }),
  // Fixed amount every recipient receives — same for all.
  // total_lamports = lamports_per_recipient * recipient_count (kept in sync on every recipient add).
  lamports_per_recipient: bigint('lamports_per_recipient', { mode: 'number' }).notNull(),
  total_lamports:        bigint('total_lamports', { mode: 'number' }).notNull().default(0),
  recipient_count:       integer('recipient_count').notNull().default(0),
  // How many recipients to pack per on-chain batch transaction.
  // Tune based on compute budget; default 30 is conservative.
  batch_size:            integer('batch_size').notNull().default(30),
  status:          airdropStatusEnum('status').default('draft').notNull(),
  created_by:      uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  approved_by:     uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approved_at:     timestamp('approved_at', { withTimezone: true }),
  completed_at:    timestamp('completed_at', { withTimezone: true }),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  status_idx: index('airdrop_campaigns_status_idx').on(t.status),
}))

export const airdrop_recipients = pgTable('airdrop_recipients', {
  id:              uuid('id').primaryKey().defaultRandom(),
  campaign_id:     uuid('campaign_id')
    .references(() => airdrop_campaigns.id, { onDelete: 'cascade' })
    .notNull(),
  // user_id nullable: recipients can be loaded by wallet before they have a server account
  user_id:         uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  wallet_address:  text('wallet_address').notNull(),
  // Batch index this recipient belongs to (0-based, grouped by campaign.batch_size).
  batch_index:     integer('batch_index').notNull(),
  status:          airdropRecipientStatusEnum('status').default('pending').notNull(),
  // On-chain signature of the batch transaction that included this recipient.
  signature:       text('signature'),
  distributed_at:  timestamp('distributed_at', { withTimezone: true }),
  failure_reason:  text('failure_reason'),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  campaign_idx:      index('airdrop_recipients_campaign_idx').on(t.campaign_id),
  batch_idx:         index('airdrop_recipients_batch_idx').on(t.campaign_id, t.batch_index),
  wallet_idx:        index('airdrop_recipients_wallet_idx').on(t.wallet_address),
  status_idx:        index('airdrop_recipients_status_idx').on(t.status),
  // Prevent the same wallet appearing twice in the same campaign
  campaign_wallet_unique: uniqueIndex('airdrop_recipients_campaign_wallet_unique').on(t.campaign_id, t.wallet_address),
}))

// ── Admin ──────────────────────────────────────────────────────────────────────

export const admin_audit_log = pgTable('admin_audit_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  // admin_id nulls out if the admin account is deleted — admin_wallet preserves identity permanently
  admin_id:     uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  admin_wallet: text('admin_wallet').notNull(),
  admin_role:   text('admin_role').notNull(),
  action:       text('action').notNull(),
  target_type:  text('target_type'),
  target_id:    text('target_id'),
  metadata:     jsonb('metadata'),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  admin_created_idx:  index('audit_log_admin_created_idx').on(t.admin_id, t.created_at),
  target_idx:         index('audit_log_target_idx').on(t.target_type, t.target_id),
  created_at_idx:     index('audit_log_created_at_idx').on(t.created_at),
}))
