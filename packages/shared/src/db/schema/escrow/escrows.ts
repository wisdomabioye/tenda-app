/**
 * The single escrow primitive (`kind` = gig | exchange). Its satellites —
 * gig/exchange details, transactions, proofs, applications — live beside it in
 * this folder and all reference `escrows.id`.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { assets, chains } from '../chains'
import { users } from '../identity'
import { escrowKindEnum, escrowStatusEnum } from './enums'

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
    // Admin takedown (CO1): hidden listings vanish from the public browse
    // surfaces (gig feed, exchange order book, public detail) but stay fully
    // operable by their parties — funds may be locked on-chain. Toggled via
    // PATCH /v1/admin/escrows/:id/hidden (escrows.takedown permission).
    hidden: boolean('hidden').notNull().default(false),
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
    /**
     * Acceptance mode, mirroring the on-chain field. `true` closes
     * `acceptEscrow` and makes the creator's `assignAccept` the only path to
     * `accepted`. Rejected for `kind='exchange'` at validation — approval mode
     * is a hiring flow, and a P2P trade has no one to approve.
     */
    requires_approval: boolean('requires_approval').notNull().default(false),
    /**
     * Was the assigned worker chosen from a live application they had raised?
     *
     * Write-once, stamped by the event applier when `CounterpartyAssigned`
     * lands. This is the whole basis of D2's strike rule: a worker who put
     * their hand up and then ghosted earns an `abandoned` signal, while a
     * worker the poster placed out of the blue does not. A back-door assign
     * (raw transaction, no application) leaves it `false`, so the rule is
     * self-correcting rather than needing the route to be trusted.
     */
    assigned_from_application: boolean('assigned_from_application').notNull().default(false),
    /**
     * The assigned worker told us they are not available (off-chain — they
     * signed nothing to be assigned, so they sign nothing to step back).
     * Suppresses the abandonment strike and prompts the poster to unassign;
     * it does NOT move the escrow, which only the creator can do on-chain.
     */
    assignment_released_at: timestamp('assignment_released_at'),
    /**
     * Mirror of the escrow's on-chain `unassign_window_seconds`, stamped at
     * create from `platform_config` and immutable thereafter — exactly like
     * `completion_duration_seconds` beside it.
     *
     * Mirrored rather than re-read from config because the on-chain value is
     * fixed per escrow: an operator retuning the default must not change how
     * long a LIVE assignment can be withdrawn for. Without this column the
     * server's guard would use today's config and could disagree with the
     * chain, either sending a doomed transaction or blocking a valid one.
     */
    unassign_window_seconds: integer('unassign_window_seconds').notNull().default(0),
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
