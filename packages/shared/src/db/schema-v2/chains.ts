import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Single source of truth for the namespace value-set. The pgEnum drives both
// the DB constraint AND the TS union — adding a value here flows everywhere.
export const chainNamespacePgEnum = pgEnum('chain_namespace', ['solana', 'eip155'])

export type ChainNamespace = (typeof chainNamespacePgEnum.enumValues)[number]

/** Runtime array for iteration / Set construction. Mirrors `ChainNamespace`. */
export const chainNamespaceEnum: ReadonlyArray<ChainNamespace> = chainNamespacePgEnum.enumValues

export const chains = pgTable(
  'chains',
  {
    id: text('id').primaryKey(), // 'solana:mainnet', 'eip155:8453'
    namespace: chainNamespacePgEnum('namespace').notNull(),
    display_name: text('display_name').notNull(),
    min_confirmations: integer('min_confirmations').notNull().default(1),
    treasury_address: text('treasury_address').notNull(),
    escrow_program: text('escrow_program').notNull(),
    // Null = no native-gas seed needed (e.g. BASE uses paymaster, CELO uses feeCurrency).
    // Non-null = one-time grant in native unit on first wallet link (phone-gated, decision #16).
    gas_seed_amount_raw: numeric('gas_seed_amount_raw', { precision: 78, scale: 0 }),
    gas_seed_wallet_address: text('gas_seed_wallet_address'),
    is_enabled: boolean('is_enabled').notNull().default(true),
  },
  (t) => [
    check(
      'chains_gas_seed_paired_chk',
      sql`(${t.gas_seed_amount_raw} IS NULL) = (${t.gas_seed_wallet_address} IS NULL)`,
    ),
  ],
)

export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(), // 'SOL', 'USDC_SOL', 'USDC_BASE', etc.
    chain_id: text('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'restrict' }),
    symbol: text('symbol').notNull(),
    decimals: integer('decimals').notNull(),
    // null = native; SPL mint or ERC-20 address otherwise.
    token_address: text('token_address'),
    is_stable: boolean('is_stable').notNull().default(false),
    is_enabled: boolean('is_enabled').notNull().default(true),
  },
  (t) => [
    // ERC-20 / SPL: one row per (chain, token-address). Partial because
    // Postgres treats NULL as distinct in unique constraints; without the
    // WHERE clause we couldn't enforce "one native per chain" below.
    uniqueIndex('assets_chain_token_uq')
      .on(t.chain_id, t.token_address)
      .where(sql`${t.token_address} IS NOT NULL`),
    // Native asset (no token contract): exactly one per chain.
    uniqueIndex('assets_one_native_per_chain_uq')
      .on(t.chain_id)
      .where(sql`${t.token_address} IS NULL`),
    // Composite uniqueness so escrows can FK-reference (chain_id, id) and
    // prevent mismatched chain/asset combinations on insert.
    unique('assets_id_chain_uq').on(t.id, t.chain_id),
  ],
)

