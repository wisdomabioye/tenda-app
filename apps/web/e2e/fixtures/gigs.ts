import type { GigDetail, GigSummary, UserRef } from '@tenda/shared'

/**
 * Typed against the REAL wire types — a fixture that stops typechecking is a
 * stub API that lies. LEAKED_* sentinels mark party-scoped values: the stub
 * serves them ON PURPOSE (a hostile-server stance) and the e2e asserts the
 * anonymous pages never render them, proving the page treats party fields as
 * absent rather than trusting the server to withhold them.
 */
export const LEAKED_COUNTERPARTY_NAME = 'LEAKED-COUNTERPARTY-NAME'
export const LEAKED_COUNTERPARTY_ID = 'leaked-counterparty-id-000'

const poster: UserRef = {
  id: 'user-poster-1',
  first_name: 'Ada',
  last_name: 'Okafor',
  avatar_url: null,
  review_score: '4.80',
  is_seeker: false,
  country: 'NG',
}

export const deliveryGig: GigSummary = {
  escrow_id: 'gig-delivery-1',
  public_feed_revision: '1',
  chain_id: 'solana:devnet',
  asset: 'USDC_SOL',
  amount_raw: '25000000',
  status: 'open',
  accept_deadline: '2030-01-01T12:00:00.000Z',
  created_at: '2026-08-15T08:00:00.000Z',
  title: 'Deliver a parcel across Yaba',
  description: 'Pick up a sealed parcel in Yaba and deliver it to Lekki before 5pm.',
  category: 'delivery',
  country: 'NG',
  city: 'Lagos',
  latitude: null,
  longitude: null,
  remote: false,
  cross_border: false,
  proof_requirements: ['image'],
  requires_approval: false,
  creator: poster,
}

export const photoGig: GigSummary = {
  ...deliveryGig,
  escrow_id: 'gig-photo-1',
  asset: 'USDC_BASE',
  chain_id: 'eip155:84532',
  amount_raw: '120000000',
  title: 'Edit a 30-second product reel',
  description: 'Remote edit of raw footage into a 30s reel.',
  category: 'photo',
  city: null,
  country: null,
  remote: true,
  requires_approval: true,
}

export const deliveryGigDetail: GigDetail = {
  ...deliveryGig,
  hidden: false,
  completion_duration_seconds: 86_400,
  completion_deadline: null,
  submitted_at: null,
  approval_deadline: null,
  dispute_bond_raw: '1000000',
  // Party-scoped, hostile-server values — must never appear in anonymous HTML.
  assigned_counterparty_id: LEAKED_COUNTERPARTY_ID,
  is_assigned: false,
  unassign_window_seconds: 3600,
  assignment_released_at: null,
  counterparty: {
    id: LEAKED_COUNTERPARTY_ID,
    first_name: LEAKED_COUNTERPARTY_NAME,
    last_name: 'LEAKED-SURNAME',
    avatar_url: null,
    review_score: null,
    is_seeker: false,
    country: 'NG',
  },
  proofs: [],
  dispute: null,
  reviews: [],
  is_seeker: false,
  viewer: null,
}
