/**
 * The reads the claim decision needs that `GasSeedStore` does not already do —
 * who the claimant is, whether they already hold a grant, and whether an
 * operator has switched this chain's claims off.
 *
 * Split from the dispatch store rather than bolted onto it because they are
 * used by different callers: the auto-send path (#53a) never asks about device
 * tokens or account status, and widening its interface would make every one of
 * its test doubles implement reads it never performs.
 */

import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { device_tokens, user_identities, users } from '@tenda/shared/db/schema'
import { gas_grants, gas_seed_settings } from '@tenda/shared/db/schema/gas-seed'
import type { AppDatabase } from '@server/plugins/db'
import type { ClaimantFacts, GrantFacts } from './eligibility'

export interface GasSeedClaimStore {
  /** Everything about the claimant the decision needs, read fresh. */
  claimantFacts(user_id: string): Promise<ClaimantFacts>
  /** This user's grant on this chain, or null. */
  findGrant(user_id: string, chain_id: string): Promise<GrantFacts | null>
  /**
   * The claimed grant as the TRANSFER needs it: how much was promised and to
   * which wallet.
   *
   * Read from the grant row rather than re-derived from config, because the job
   * runs after the claim and both could have moved: an operator may have
   * re-seeded a different amount, and the user may have linked another wallet.
   * The row records what they were promised, and that is what gets paid.
   */
  findClaimedGrant(
    user_id: string,
    chain_id: string,
  ): Promise<{ tx_ref: string; amount_raw: string; wallet_address: string | null } | null>
  /**
   * Chains whose claims an operator has switched OFF.
   *
   * The negative set, not the positive one: an absent row means enabled, so a
   * newly seedable chain needs no row and the table only ever holds exceptions.
   */
  disabledChains(): Promise<ReadonlySet<string>>
}

export function drizzleGasSeedClaimStore(db: AppDatabase): GasSeedClaimStore {
  return {
    async claimantFacts(user_id) {
      // Three reads in parallel rather than a single join: they touch three
      // unrelated tables, and a join would make the whole thing miss when any
      // one of them has no row (a user with no device token has no
      // device_tokens row at all).
      const [account, devices, phones] = await Promise.all([
        db
          .select({ status: users.status, is_agent: users.is_agent })
          .from(users)
          .where(eq(users.id, user_id))
          .limit(1),
        db
          .select({ one: sql<number>`1` })
          .from(device_tokens)
          .where(eq(device_tokens.user_id, user_id))
          .limit(1),
        db
          .select({ one: sql<number>`1` })
          .from(user_identities)
          .where(
            and(
              eq(user_identities.user_id, user_id),
              eq(user_identities.kind, 'phone'),
              isNotNull(user_identities.verified_at),
            ),
          )
          .limit(1),
      ])
      return {
        // The client stamp is a property of the SESSION, not of the account, so
        // it is supplied by the caller from the token rather than read here.
        client: null,
        has_device_token: devices.length > 0,
        has_verified_phone: phones.length > 0,
        // A missing user row reads as suspended, not as active. This runs on a
        // payout path; "the account could not be found" must never resolve to
        // "so go ahead". (It is unreachable through the route — `authenticate`
        // has already resolved the token — but the store is callable elsewhere.)
        is_suspended: account[0]?.status !== 'active',
        is_agent: account[0]?.is_agent === true,
      }
    },

    async findGrant(user_id, chain_id) {
      const rows = await db
        .select({ tx_ref: gas_grants.tx_ref })
        .from(gas_grants)
        .where(and(eq(gas_grants.user_id, user_id), eq(gas_grants.chain_id, chain_id)))
        .limit(1)
      const row = rows[0]
      return row === undefined ? null : { tx_ref: row.tx_ref }
    },

    async findClaimedGrant(user_id, chain_id) {
      const rows = await db
        .select({
          tx_ref: gas_grants.tx_ref,
          amount_raw: gas_grants.amount_raw,
          wallet_address: gas_grants.wallet_address,
        })
        .from(gas_grants)
        .where(and(eq(gas_grants.user_id, user_id), eq(gas_grants.chain_id, chain_id)))
        .limit(1)
      return rows[0] ?? null
    },

    async disabledChains() {
      const rows = await db
        .select({ chain_id: gas_seed_settings.chain_id })
        .from(gas_seed_settings)
        .where(eq(gas_seed_settings.claims_enabled, false))
      return new Set(rows.map((r) => r.chain_id))
    },
  }
}
