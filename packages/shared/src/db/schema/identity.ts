import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { chainNamespacePgEnum, chains } from './chains'

export const userRoleEnum = pgEnum('user_role', [
  'user',
  'dispute_admin',
  'super_admin',
])

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    first_name: text('first_name').notNull().default(''),
    last_name: text('last_name').notNull().default(''),
    bio: text('bio'),
    avatar_url: text('avatar_url'),
    country: text('country'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    phone_e164: text('phone_e164').unique('users_phone_e164_uq'),
    phone_verified_at: timestamp('phone_verified_at'),
    role: userRoleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    is_seeker: boolean('is_seeker').notNull().default(false),
    review_score: numeric('review_score', { precision: 3, scale: 2 }),
    sponsored_tx_remaining: integer('sponsored_tx_remaining').notNull().default(3),
    advanced_mode_enabled: boolean('advanced_mode_enabled').notNull().default(false),
    /** UI rendering preference ('NGN', 'USD'); null = show raw asset (stage-8). */
    display_currency: varchar('display_currency', { length: 3 }),
    last_active_at: timestamp('last_active_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('users_country_idx').on(t.country)],
)

export const user_wallets = pgTable(
  'user_wallets',
  {
    chain_ns: chainNamespacePgEnum('chain_ns').notNull(),
    address: text('address').notNull(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    is_primary: boolean('is_primary').notNull().default(false),
    verified_at: timestamp('verified_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chain_ns, t.address] }),
    index('user_wallets_user_idx').on(t.user_id),
    uniqueIndex('user_wallets_one_primary_per_user_idx')
      .on(t.user_id)
      .where(sql`${t.is_primary} = true`),
    // S5.7 (closes open A6): admin wallet prefix search (LIKE 'abc%') needs
    // the text_pattern_ops operator class.
    index('user_wallets_address_prefix_idx').using(
      'btree',
      sql`${t.address} text_pattern_ops`,
    ),
  ],
)

export const auth_nonces = pgTable(
  'auth_nonces',
  {
    nonce: text('nonce').primaryKey(),
    expires_at: timestamp('expires_at').notNull(),
    consumed_at: timestamp('consumed_at'),
  },
  (t) => [index('auth_nonces_expires_idx').on(t.expires_at)],
)

// Phone OTP (Termii / Twilio). Pre-account-creation rows have user_id = null.
export const phone_otps = pgTable(
  'phone_otps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone_e164: text('phone_e164').notNull(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    code_hash: text('code_hash').notNull(),
    expires_at: timestamp('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumed_at: timestamp('consumed_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('phone_otps_phone_idx').on(t.phone_e164, t.created_at)],
)

// First-link native-gas seed grants. PRIMARY KEY (user_id, chain_id) keeps
// the grant idempotent across wallet rotations on the same chain.
export const gas_grants = pgTable(
  'gas_grants',
  {
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    chain_id: text('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'restrict' }),
    amount_raw: numeric('amount_raw', { precision: 78, scale: 0 }).notNull(),
    // UNIQUE so a retried insert with the same on-chain ref is rejected at
    // the DB layer — defence in depth on top of the (user_id, chain_id) PK.
    tx_ref: text('tx_ref').notNull().unique('gas_grants_tx_ref_uq'),
    granted_at: timestamp('granted_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.chain_id] }),
    index('gas_grants_chain_idx').on(t.chain_id),
  ],
)

