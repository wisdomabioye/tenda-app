/**
 * The gas-seed feature's tables (#53a, #53c-1).
 *
 * Their OWN module rather than more of `identity.ts`, for the reason the
 * server-side feature lives in one directory: the seed is a subsidy, and a
 * subsidy is exactly the kind of thing a business turns off. Keeping its
 * storage together means the removal recipe in
 * `apps/server/src/features/gas-seed/index.ts` can name one schema file rather
 * than hunting two tables out of an identity module. Splitting it out also took
 * identity.ts back under the 300-line ceiling.
 *
 * They are NOT identity: a grant is a payment record and the settings row is an
 * operational switch. Neither says anything about who a user is.
 */

import { boolean, index, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { chains } from './chains'
import { users } from './identity'

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
    /**
     * WHICH wallet was paid, recorded at claim time (#53c-1). The grant is
     * keyed by user, but a user may hold several wallets on one chain and may
     * unlink the one that was funded — without this, "where did the money go"
     * has no answer once the row in `user_wallets` is gone.
     */
    wallet_address: text('wallet_address'),
    /**
     * WHICH hot wallet paid, recorded per grant (#53c-1).
     *
     * The funder used to be readable only from `chains.gas_seed_wallet_address`,
     * a single CURRENT value that `db:seed` rewrites from whatever key the
     * booting replica holds. `verify-gas-seed` checked every historical grant
     * against it, so rotating a seed key retroactively flagged every grant the
     * OLD wallet paid as "funded by the wrong wallet" — an alarm that fires on
     * a correct operation. Per grant, rotation creates no drift and the history
     * stays true. The chain column keeps its own meaning: what is configured
     * NOW, not what paid then.
     */
    funder_address: text('funder_address'),
    granted_at: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.chain_id] }),
    index('gas_grants_chain_idx').on(t.chain_id),
  ],
)

/**
 * Per-chain switch for gas-seed CLAIMS (#53c-1) — the off-switch an operator
 * needs while rotating a hot-wallet key, reachable without a deploy.
 *
 * WHY ITS OWN TABLE rather than a `chains` column: `db:seed` REWRITES every
 * `chains` row from the manifest on each boot under SEED_ON_BOOT, so a toggle
 * living there is silently undone by the next restart. It is not on
 * `platform_config` either — that row survives re-seeding (ON CONFLICT DO
 * NOTHING), but it is a singleton, and rotation is per chain: taking Solana's
 * claims down to roll 0G's key is not the operation anyone wants.
 *
 * ABSENT ROW MEANS ENABLED. A new seedable chain therefore needs no row, and
 * the switch is only ever written to turn something OFF and back on.
 */
export const gas_seed_settings = pgTable('gas_seed_settings', {
  chain_id: text('chain_id')
    .primaryKey()
    .references(() => chains.id, { onDelete: 'cascade' }),
  claims_enabled: boolean('claims_enabled').notNull().default(true),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
