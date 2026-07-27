/**
 * GigDetail builders for component and branch tests.
 *
 * Shared so a new field on the wire type breaks ONE file instead of every
 * test that happened to construct a gig — the drift that made the CTA tests
 * expensive to keep honest.
 *
 * Lives in __fixtures__, not __tests__: jest-expo's testMatch treats every
 * file under __tests__ as a suite and fails one that declares no tests.
 */
import type { GigApplication, GigDetail, UserRef } from '@tenda/shared'

export const CREATOR_ID = 'user-creator'
export const WORKER_ID = 'user-worker'
export const STRANGER_ID = 'user-stranger'

export function userRef(id: string): UserRef {
  return {
    id,
    first_name: 'Ada',
    last_name: 'Lovelace',
    avatar_url: null,
    review_score: null,
    country: 'NG',
    is_seeker: false,
  }
}

export function application(overrides: Partial<GigApplication> = {}): GigApplication {
  return {
    id: 'app-1',
    escrow_id: 'escrow-1',
    applicant_id: WORKER_ID,
    message: null,
    status: 'open',
    // Comfortably in the future so a test that does not care about expiry
    // never trips over it.
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * An instant-mode gig by default. Approval-mode tests opt in explicitly, which
 * keeps the mode visible at every call site rather than buried in a default.
 */
export function gigDetail(overrides: Partial<GigDetail> = {}): GigDetail {
  return {
    escrow_id: 'escrow-1',
    chain_id: 'solana:devnet',
    asset: 'USDC_SOL',
    amount_raw: '1000000',
    status: 'open',
    accept_deadline: null,
    created_at: '2026-07-01T00:00:00.000Z',
    title: 'Paint the fence',
    description: null,
    category: 'service',
    country: 'NG',
    city: 'Lagos',
    latitude: null,
    longitude: null,
    remote: false,
    cross_border: false,
    proof_requirements: [],
    requires_approval: false,
    creator: userRef(CREATOR_ID),
    completion_duration_seconds: 3600,
    completion_deadline: null,
    submitted_at: null,
    approval_deadline: null,
    dispute_bond_raw: '0',
    assigned_counterparty_id: null,
    unassign_window_seconds: 3600,
    assignment_released_at: null,
    counterparty: null,
    proofs: [],
    dispute: null,
    reviews: [],
    is_seeker: false,
    viewer: null,
    ...overrides,
  }
}

/**
 * An approval-mode gig with a worker assigned a known time ago, so the
 * unassign window is computable: both contracts derive `accepted_at` as
 * `completion_deadline - completion_duration_seconds`.
 */
export function assignedApprovalGig(
  {
    assignedSecondsAgo = 60,
    unassignWindowSeconds = 3600,
    // Independent of the unassign window on purpose: the two expire at
    // different times, and a fixture that ties them together cannot express
    // "the release window closed but the work is not yet late".
    durationSeconds = 7 * 24 * 3600,
  } = {},
  overrides: Partial<GigDetail> = {},
): GigDetail {
  const acceptedAt = Date.now() - assignedSecondsAgo * 1000
  return gigDetail({
    status: 'accepted',
    requires_approval: true,
    counterparty: userRef(WORKER_ID),
    completion_duration_seconds: durationSeconds,
    completion_deadline: new Date(acceptedAt + durationSeconds * 1000).toISOString(),
    unassign_window_seconds: unassignWindowSeconds,
    ...overrides,
  })
}
