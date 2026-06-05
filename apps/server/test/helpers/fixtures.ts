/**
 * Typed object factories for tests. Real implementations — usable now without
 * a DB or any external infra.
 *
 * Each factory:
 *   - Returns a fully-populated, schema-shaped object.
 *   - Accepts a `Partial<T>` of overrides for the columns the test cares about.
 *   - Uses deterministic defaults where possible (stable UUIDs, fixed timestamps)
 *     so test failures diff cleanly.
 *
 * The intent is "what's being asserted is visible in the test body" — never
 * have a test hand-roll 15 columns of escrow fixture inline.
 */

import { randomUUID } from 'node:crypto'

export interface UserRow {
  id: string
  first_name: string
  last_name: string
  bio: string | null
  avatar_url: string | null
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  phone_e164: string | null
  phone_verified_at: Date | null
  role: 'user' | 'dispute_admin' | 'super_admin'
  status: 'active' | 'suspended'
  is_seeker: boolean
  review_score: string | null
  sponsored_tx_remaining: number
  advanced_mode_enabled: boolean
  last_active_at: Date | null
  created_at: Date
  updated_at: Date
}

export function userFixture(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: randomUUID(),
    first_name: 'Test',
    last_name: 'User',
    bio: null,
    avatar_url: null,
    country: 'NG',
    city: null,
    latitude: null,
    longitude: null,
    phone_e164: null,
    phone_verified_at: null,
    role: 'user',
    status: 'active',
    is_seeker: false,
    review_score: null,
    sponsored_tx_remaining: 3,
    advanced_mode_enabled: false,
    last_active_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export interface UserWalletRow {
  chain_ns: 'solana' | 'eip155'
  address: string
  user_id: string
  is_primary: boolean
  verified_at: Date
}

export function walletFixture(overrides: Partial<UserWalletRow> = {}): UserWalletRow {
  return {
    chain_ns: 'solana',
    address: 'TestSolanaAddress11111111111111111111111111',
    user_id: randomUUID(),
    is_primary: true,
    verified_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

export type EscrowStatus =
  | 'draft'
  | 'open'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'resolved'

export interface EscrowRow {
  id: string
  kind: 'gig' | 'exchange'
  chain_id: string
  asset: string
  amount_raw: string
  creator_id: string
  counterparty_id: string | null
  assigned_counterparty_id: string | null
  status: EscrowStatus
  hidden: boolean
  escrow_ref: string | null
  accept_deadline: Date | null
  completion_duration_seconds: number | null
  completion_deadline: Date | null
  submitted_at: Date | null
  approval_deadline: Date | null
  dispute_bond_raw: string
  is_seeker: boolean
  sponsored_tx_used: number
  created_at: Date
  updated_at: Date
}

export function escrowFixture(overrides: Partial<EscrowRow> = {}): EscrowRow {
  const now = new Date('2026-01-01T00:00:00Z')
  const id = overrides.id ?? randomUUID()
  // Default to 'draft' so the fixture mirrors a row that hasn't been
  // published on-chain yet. `escrow_ref` is set on publish; defaulting to
  // `open` + null ref would produce schema-invalid rows. Callers that want
  // an `open` escrow must supply `escrow_ref`.
  const status: EscrowStatus = overrides.status ?? 'draft'
  return {
    id,
    kind: 'gig',
    chain_id: 'solana:mainnet',
    asset: 'USDC_SOL',
    amount_raw: '1000000', // 1 USDC at 6 decimals
    creator_id: randomUUID(),
    counterparty_id: null,
    assigned_counterparty_id: null,
    status,
    hidden: false,
    escrow_ref: status === 'draft' ? null : `escrow-ref-${id}`,
    accept_deadline: new Date('2026-01-08T00:00:00Z'),
    completion_duration_seconds: 86_400,
    completion_deadline: null,
    submitted_at: null,
    approval_deadline: null,
    dispute_bond_raw: '0',
    is_seeker: false,
    sponsored_tx_used: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}
