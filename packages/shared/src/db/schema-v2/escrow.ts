import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assets, chains } from './chains'
import { users } from './identity'

export const escrowKindEnum = pgEnum('escrow_kind', ['gig', 'exchange'])

export const escrowStatusEnum = pgEnum('escrow_status', [
  'draft',
  'open',
  'accepted',
  'submitted',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'resolved',
])

export const escrowTxTypeEnum = pgEnum('escrow_tx_type', [
  'create',
  'accept',
  'decline',
  'submit',
  'approve',
  'claim_stalled',
  'cancel',
  'refund_expired',
  'reclaim_abandoned',
  'dispute',
  'resolve',
])

export const proofTypeEnum = pgEnum('proof_type_v2', ['image', 'video', 'document'])

export const escrows = pgTable(
  'escrows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: escrowKindEnum('kind').notNull(),
    chain_id: text('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'restrict' }),
    // FK is the composite (asset, chain_id) below — not directly on `asset`.
    // Prevents inserting an escrow with chain_id='solana:mainnet' and
    // asset='USDC_BASE'.
    asset: text('asset').notNull(),
    amount_raw: numeric('amount_raw', { precision: 78, scale: 0 }).notNull(),
    // Explicit RESTRICT so a user with any escrow history can't be hard-deleted;
    // account closure is a soft-delete via users.status='suspended' + a deletion
    // job that runs only when all escrows are in terminal state.
    creator_id: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    counterparty_id: uuid('counterparty_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    assigned_counterparty_id: uuid('assigned_counterparty_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    status: escrowStatusEnum('status').notNull(),
    escrow_ref: text('escrow_ref').unique('escrows_escrow_ref_uq'),
    accept_deadline: timestamp('accept_deadline'),
    completion_duration_seconds: integer('completion_duration_seconds'),
    completion_deadline: timestamp('completion_deadline'),
    submitted_at: timestamp('submitted_at'),
    approval_deadline: timestamp('approval_deadline'),
    dispute_bond_raw: numeric('dispute_bond_raw', { precision: 78, scale: 0 })
      .notNull()
      .default('0'),
    is_seeker: boolean('is_seeker').notNull().default(false),
    sponsored_tx_used: integer('sponsored_tx_used').notNull().default(0),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('escrows_status_idx').on(t.status),
    index('escrows_chain_idx').on(t.chain_id),
    index('escrows_creator_idx').on(t.creator_id),
    index('escrows_counterparty_idx').on(t.counterparty_id),
    index('escrows_assigned_idx')
      .on(t.assigned_counterparty_id)
      .where(sql`${t.assigned_counterparty_id} IS NOT NULL`),
    index('escrows_accept_deadline_idx').on(t.accept_deadline),
    index('escrows_approval_deadline_idx').on(t.approval_deadline),
    check('escrows_creator_not_counterparty_chk', sql`${t.creator_id} <> ${t.counterparty_id}`),
    check(
      'escrows_creator_not_assigned_chk',
      sql`${t.creator_id} <> ${t.assigned_counterparty_id}`,
    ),
    check('escrows_amount_positive_chk', sql`${t.amount_raw} > 0`),
    foreignKey({
      name: 'escrows_asset_chain_fk',
      columns: [t.asset, t.chain_id],
      foreignColumns: [assets.id, assets.chain_id],
    }).onUpdate('restrict').onDelete('restrict'),
  ],
)

export const gig_details = pgTable(
  'gig_details',
  {
    escrow_id: uuid('escrow_id')
      .primaryKey()
      .references(() => escrows.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    country: text('country'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    remote: boolean('remote').notNull().default(false),
    cross_border: boolean('cross_border').notNull().default(false),
  },
  (t) => [
    index('gig_details_category_idx').on(t.category),
    index('gig_details_country_idx').on(t.country),
  ],
)

export const exchange_details = pgTable('exchange_details', {
  escrow_id: uuid('escrow_id')
    .primaryKey()
    .references(() => escrows.id, { onDelete: 'cascade' }),
  fiat_amount: numeric('fiat_amount', { precision: 20, scale: 4 }).notNull(),
  fiat_currency: varchar('fiat_currency', { length: 3 }).notNull(),
  rate: numeric('rate', { precision: 30, scale: 10 }).notNull(),
  payment_window_seconds: integer('payment_window_seconds').notNull(),
  payment_proof_url: text('payment_proof_url'),
})

export const escrow_transactions = pgTable(
  'escrow_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    escrow_id: uuid('escrow_id')
      .notNull()
      .references(() => escrows.id, { onDelete: 'cascade' }),
    type: escrowTxTypeEnum('type').notNull(),
    tx_ref: text('tx_ref').notNull().unique('escrow_transactions_tx_ref_uq'),
    amount_raw: numeric('amount_raw', { precision: 78, scale: 0 }),
    platform_fee_raw: numeric('platform_fee_raw', { precision: 78, scale: 0 }),
    actor_id: uuid('actor_id').references(() => users.id, { onDelete: 'restrict' }),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('escrow_transactions_escrow_idx').on(t.escrow_id),
    index('escrow_transactions_created_at_idx').on(t.created_at),
  ],
)

// Client-side tx-submission audit log. Reconcile cron reads this. Replaces
// any notion of "in-flight" intermediate statuses on escrows.status.
export const tx_attempts = pgTable(
  'tx_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    escrow_id: uuid('escrow_id').references(() => escrows.id, { onDelete: 'cascade' }),
    action: escrowTxTypeEnum('action').notNull(),
    tx_ref: text('tx_ref').notNull().unique('tx_attempts_tx_ref_uq'),
    submitted_at: timestamp('submitted_at').notNull().defaultNow(),
    confirmed_at: timestamp('confirmed_at'),
    failed_at: timestamp('failed_at'),
    failure_code: text('failure_code'),
    // Set at reservation time by lib/sponsor.ts; verify-tx job reads this to
    // decide whether to commit the sponsored_tx_remaining decrement or
    // restore it on failure. See stage-0 § Sponsored-tx reservation pattern.
    was_sponsored: boolean('was_sponsored').notNull().default(false),
  },
  (t) => [
    index('tx_attempts_pending_idx')
      .on(t.submitted_at)
      .where(sql`${t.confirmed_at} IS NULL AND ${t.failed_at} IS NULL`),
    index('tx_attempts_user_idx').on(t.user_id),
  ],
)

export const escrow_proofs = pgTable(
  'escrow_proofs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    escrow_id: uuid('escrow_id')
      .notNull()
      .references(() => escrows.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    type: proofTypeEnum('type').notNull(),
    uploaded_at: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (t) => [index('escrow_proofs_escrow_idx').on(t.escrow_id)],
)
