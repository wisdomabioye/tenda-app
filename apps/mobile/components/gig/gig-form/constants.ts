import type { GigCategory } from '@tenda/shared'

export const TITLE_MAX = 80
export const DESC_MAX = 1500

export const CATEGORY_HINTS: Record<GigCategory, string> = {
  delivery: 'Pickup address, drop-off, package size, fragility notes.',
  photo:    'Type of shoot (product/event/portrait), duration, edits expected.',
  errand:   'What needs doing, where, and any items + budget to purchase.',
  service:  'Type of service, tools/materials, accessibility requirements.',
  digital:  'Scope, deliverable format, revision rounds, tools/accounts.',
}

/** Appended to every description hint — proof is required to complete any gig. */
export const PROOF_NOTE = 'Proof required before the gig can be considered completed.'

// v2 escrows REQUIRE an accept deadline (the on-chain refund window keys
// off it), '30d' is the long-tail option that replaced 'No limit'.
export const ACCEPT_DEADLINE_OPTIONS: { label: string; hours: number }[] = [
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '3d',  hours: 72 },
  { label: '7d',  hours: 168 },
  { label: '30d', hours: 720 },
]

export interface GigFormValues {
  title: string
  description: string
  /** CAIP-2 chain + its gig asset (CO5), always a gigAssetByChain pair. */
  chainId: string
  asset: string
  /** Budget in raw units of `asset`. */
  paymentRaw: number
  completionDuration: number
  category: GigCategory | null
  country: string | null
  remote: boolean
  city: string | null
  acceptDeadlineHours: number
}
