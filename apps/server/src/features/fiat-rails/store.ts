/**
 * Fiat-rails persistence seam + drizzle implementation. Status writes are
 * guarded (`whereStatus`) so webhook replays / reconcile races can't
 * regress a settled intent.
 */

import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { fiat_intents, bank_accounts } from '@tenda/shared/db/schema-v2/fiat'
import type { AppDatabase } from '@server/plugins/db'
import type { FiatIntentRow, FiatIntentStatus, FiatDirection } from './types'

/** Statuses the reconcile/expiry jobs consider "open". */
export const OPEN_STATUSES: readonly FiatIntentStatus[] = [
  'quoted',
  'awaiting_user',
  'awaiting_provider',
  'settling',
]

export interface NewFiatIntent {
  direction: FiatDirection
  user_id: string
  wallet_address: string
  chain_id: string
  provider: string
  fiat_currency: string
  fiat_amount: string
  asset: string
  asset_amount_raw: string
  rate: string
  fee_amount: string
  status: FiatIntentStatus
  provider_ref: string | null
  kyc_required: boolean
  kyc_url: string | null
  expires_at: Date
  metadata: unknown
}

export interface IntentPatch {
  status?: FiatIntentStatus
  provider_ref?: string
  kyc_url?: string | null
  metadata?: unknown
}

export interface FiatStore {
  insertIntent(row: NewFiatIntent): Promise<FiatIntentRow>
  getIntent(id: string): Promise<FiatIntentRow | null>
  getIntentByProviderRef(provider: string, provider_ref: string): Promise<FiatIntentRow | null>
  listIntentsByUser(user_id: string, limit: number): Promise<FiatIntentRow[]>
  /**
   * Status-guarded patch: applies only while the row is in one of
   * `from`. Returns the updated row or null when the guard missed
   * (concurrent transition — caller treats as already-handled).
   */
  transition(id: string, from: readonly FiatIntentStatus[], patch: IntentPatch): Promise<FiatIntentRow | null>
  /** Open intents older than `olderThan` — reconcile candidates. */
  listStaleOpen(olderThan: Date, limit: number): Promise<FiatIntentRow[]>
  /** Quoted/awaiting_user intents whose quote expired before `now`. */
  listExpiredQuotes(now: Date, limit: number): Promise<FiatIntentRow[]>
}

export function drizzleFiatStore(db: AppDatabase): FiatStore {
  return {
    async insertIntent(row) {
      const [inserted] = await db.insert(fiat_intents).values(row).returning()
      return inserted as FiatIntentRow
    },

    async getIntent(id) {
      const [row] = await db.select().from(fiat_intents).where(eq(fiat_intents.id, id)).limit(1)
      return (row as FiatIntentRow | undefined) ?? null
    },

    async getIntentByProviderRef(provider, provider_ref) {
      const [row] = await db
        .select()
        .from(fiat_intents)
        .where(and(eq(fiat_intents.provider, provider), eq(fiat_intents.provider_ref, provider_ref)))
        .limit(1)
      return (row as FiatIntentRow | undefined) ?? null
    },

    async listIntentsByUser(user_id, limit) {
      const rows = await db
        .select()
        .from(fiat_intents)
        .where(eq(fiat_intents.user_id, user_id))
        .orderBy(sql`${fiat_intents.created_at} DESC`)
        .limit(limit)
      return rows as FiatIntentRow[]
    },

    async transition(id, from, patch) {
      const [row] = await db
        .update(fiat_intents)
        .set(patch)
        .where(and(eq(fiat_intents.id, id), inArray(fiat_intents.status, [...from])))
        .returning()
      return (row as FiatIntentRow | undefined) ?? null
    },

    async listStaleOpen(olderThan, limit) {
      const rows = await db
        .select()
        .from(fiat_intents)
        .where(
          and(
            inArray(fiat_intents.status, [...OPEN_STATUSES]),
            lt(fiat_intents.updated_at, olderThan),
          ),
        )
        .orderBy(fiat_intents.updated_at)
        .limit(limit)
      return rows as FiatIntentRow[]
    },

    async listExpiredQuotes(now, limit) {
      const rows = await db
        .select()
        .from(fiat_intents)
        .where(
          and(
            inArray(fiat_intents.status, ['quoted', 'awaiting_user']),
            lt(fiat_intents.expires_at, now),
          ),
        )
        .orderBy(fiat_intents.expires_at)
        .limit(limit)
      return rows as FiatIntentRow[]
    },
  }
}

// ---------- bank accounts -----------------------------------------------------

export interface BankAccountRow {
  id: string
  user_id: string
  country: string
  bank_code: string
  account_number: string
  account_name: string
  is_default: boolean
  verified_at: Date | null
  created_at: Date
}

export interface BankAccountStore {
  list(user_id: string): Promise<BankAccountRow[]>
  get(user_id: string, id: string): Promise<BankAccountRow | null>
  insert(row: {
    user_id: string
    country: string
    bank_code: string
    account_number: string
    account_name: string
    is_default: boolean
    verified_at: Date | null
  }): Promise<BankAccountRow>
  remove(user_id: string, id: string): Promise<boolean>
}

export function drizzleBankAccountStore(db: AppDatabase): BankAccountStore {
  return {
    async list(user_id) {
      const rows = await db
        .select()
        .from(bank_accounts)
        .where(eq(bank_accounts.user_id, user_id))
        .orderBy(sql`${bank_accounts.created_at} DESC`)
      return rows as BankAccountRow[]
    },

    async get(user_id, id) {
      const [row] = await db
        .select()
        .from(bank_accounts)
        .where(and(eq(bank_accounts.id, id), eq(bank_accounts.user_id, user_id)))
        .limit(1)
      return (row as BankAccountRow | undefined) ?? null
    },

    async insert(row) {
      const [inserted] = await db.insert(bank_accounts).values(row).returning()
      return inserted as BankAccountRow
    },

    async remove(user_id, id) {
      const rows = await db
        .delete(bank_accounts)
        .where(and(eq(bank_accounts.id, id), eq(bank_accounts.user_id, user_id)))
        .returning({ id: bank_accounts.id })
      return rows.length > 0
    },
  }
}
