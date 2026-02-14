import type { GigCategory } from '@tenda/shared'

// ── Local mock types mirroring the shared schema ──────────────────────
// We define these locally so mock data works without a shared build step.
// When the API is wired up, replace with imports from @tenda/shared.

export type GigStatus =
  | 'draft'
  | 'open'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'disputed'
  | 'cancelled'

export interface MockUser {
  id: string
  wallet_address: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  city: string | null
  reputation_score: number | null
  created_at: Date | null
  updated_at: Date | null
}

export interface MockGig {
  id: string
  poster_id: string
  worker_id: string | null
  title: string
  description: string
  payment: number
  category: string
  status: GigStatus
  city: string
  address: string | null
  deadline: Date
  proof_urls: string[]
  dispute_reason: string | null
  escrow_address: string | null
  transaction_signature: string | null
  created_at: Date | null
  updated_at: Date | null
}

export interface MockGigDetail extends MockGig {
  poster: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    reputation_score: number | null
  }
  worker: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    reputation_score: number | null
  } | null
}

// ── Category metadata ─────────────────────────────────────────────────

export interface CategoryMeta {
  key: GigCategory
  label: string
  icon: string // lucide icon name
  colorToken: keyof typeof categoryColorTokens
}

const categoryColorTokens = {
  delivery: 'categoryDelivery',
  photo: 'categoryPhoto',
  errand: 'categoryErrand',
  service: 'categoryService',
  digital: 'categoryDigital',
} as const

export const CATEGORY_META: CategoryMeta[] = [
  { key: 'delivery', label: 'Delivery', icon: 'Truck', colorToken: 'delivery' },
  { key: 'photo', label: 'Photo', icon: 'Camera', colorToken: 'photo' },
  { key: 'errand', label: 'Errand', icon: 'ShoppingBag', colorToken: 'errand' },
  { key: 'service', label: 'Service', icon: 'Wrench', colorToken: 'service' },
  { key: 'digital', label: 'Digital', icon: 'Monitor', colorToken: 'digital' },
]

export function getCategoryColor(category: string): string {
  return categoryColorTokens[category as GigCategory] ?? 'categoryService'
}

// ── Status → Badge variant mapping ────────────────────────────────────

export const STATUS_BADGE_VARIANT: Record<GigStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral',
  open: 'info',
  accepted: 'warning',
  submitted: 'warning',
  completed: 'success',
  disputed: 'danger',
  cancelled: 'neutral',
}

export const STATUS_LABEL: Record<GigStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  accepted: 'Accepted',
  submitted: 'Submitted',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
}

// ── Mock users ────────────────────────────────────────────────────────
export const MOCK_USERS: MockUser[] = [
  {
    id: 'u2',
    wallet_address: '3Fmz7nPLZBYqYr6Pz2VxJKcEgDFx5nDgMxFSWXzMr5Xy',
    first_name: 'Chioma',
    last_name: 'Eze',
    avatar_url: null,
    city: 'Lagos',
    reputation_score: 92,
    created_at: new Date('2025-10-15'),
    updated_at: new Date('2025-12-10'),
  },
  {
    id: 'u3',
    wallet_address: '9kQFEL8ZMSD9bHMhvK8Fv5pN4YxLjVg5NxmZnWqXkSkV',
    first_name: 'Emeka',
    last_name: 'Nwankwo',
    avatar_url: null,
    city: 'Abuja',
    reputation_score: 78,
    created_at: new Date('2025-09-20'),
    updated_at: new Date('2025-11-30'),
  },
]

// ── Mock gigs ─────────────────────────────────────────────────────────

const now = new Date()
const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

export const MOCK_GIGS: MockGig[] = [
  {
    id: 'g1',
    poster_id: 'u2',
    worker_id: null,
    title: 'Deliver package to Victoria Island',
    description: 'Need someone to pick up a small package from Yaba and deliver it to Victoria Island before 5pm. Package weighs about 2kg.',
    payment: 350000,
    category: 'delivery',
    status: 'open',
    city: 'Lagos',
    address: 'Yaba, Lagos',
    deadline: inTwoDays,
    proof_urls: [],
    dispute_reason: null,
    escrow_address: null,
    transaction_signature: null,
    created_at: yesterday,
    updated_at: yesterday,
  },
  {
    id: 'g2',
    poster_id: 'u3',
    worker_id: null,
    title: 'Photograph restaurant menu items',
    description: 'Professional photos needed for 15 menu items at our new restaurant in Lekki. Must have your own camera equipment.',
    payment: 1500000,
    category: 'photo',
    status: 'open',
    city: 'Lagos',
    address: 'Lekki Phase 1',
    deadline: inFiveDays,
    proof_urls: [],
    dispute_reason: null,
    escrow_address: null,
    transaction_signature: null,
    created_at: yesterday,
    updated_at: yesterday,
  },
  {
    id: 'g3',
    poster_id: 'u2',
    worker_id: 'u1',
    title: 'Pick up dry cleaning from Surulere',
    description: 'Collect my dry cleaning from Zenith Cleaners on Adeniran Ogunsanya Street and bring to my office in Ikoyi.',
    payment: 200000,
    category: 'errand',
    status: 'accepted',
    city: 'Lagos',
    address: 'Surulere, Lagos',
    deadline: inTwoDays,
    proof_urls: [],
    dispute_reason: null,
    escrow_address: 'EscAddr123',
    transaction_signature: null,
    created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    updated_at: yesterday,
  },
  {
    id: 'g4',
    poster_id: 'u1',
    worker_id: null,
    title: 'Fix leaking kitchen tap',
    description: 'Kitchen tap has been dripping for a week. Need an experienced plumber to fix or replace it. I will provide materials if needed.',
    payment: 500000,
    category: 'service',
    status: 'open',
    city: 'Lagos',
    address: 'Gbagada, Lagos',
    deadline: inOneWeek,
    proof_urls: [],
    dispute_reason: null,
    escrow_address: null,
    transaction_signature: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'g5',
    poster_id: 'u3',
    worker_id: null,
    title: 'Design social media flyers',
    description: 'Need 5 Instagram-ready flyer designs for a fashion brand launch. Must be delivered as PSD and PNG files.',
    payment: 800000,
    category: 'digital',
    status: 'open',
    city: 'Abuja',
    address: null,
    deadline: inFiveDays,
    proof_urls: [],
    dispute_reason: null,
    escrow_address: null,
    transaction_signature: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'g6',
    poster_id: 'u2',
    worker_id: 'u1',
    title: 'Move furniture to new apartment',
    description: 'Help move a sofa, dining table, and 4 chairs from Ikeja to Magodo. Transport will be provided.',
    payment: 600000,
    category: 'errand',
    status: 'completed',
    city: 'Lagos',
    address: 'Ikeja, Lagos',
    deadline: yesterday,
    proof_urls: ['https://example.com/proof1.jpg'],
    dispute_reason: null,
    escrow_address: 'EscAddr456',
    transaction_signature: 'TxSig789',
    created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    updated_at: yesterday,
  },
]

// ── Mock gig details (with poster/worker info) ────────────────────────

function getUserSummary(userId: string) {
  const u = MOCK_USERS.find((u) => u.id === userId)
  if (!u) return null
  return {
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    avatar_url: u.avatar_url,
    reputation_score: u.reputation_score,
  }
}

export function getMockGigDetail(gigId: string): MockGigDetail | null {
  const gig = MOCK_GIGS.find((g) => g.id === gigId)
  if (!gig) return null

  const poster = getUserSummary(gig.poster_id)
  if (!poster) return null

  const worker = gig.worker_id ? getUserSummary(gig.worker_id) : null

  return { ...gig, poster, worker }
}
