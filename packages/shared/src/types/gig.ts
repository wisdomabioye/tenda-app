import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { gigs } from '../db/schema'

export type Gig = InferSelectModel<typeof gigs>
export type NewGig = InferInsertModel<typeof gigs>

export type GigStatus =
  | 'draft'
  | 'open'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'disputed'
  | 'cancelled'

export interface CreateGigInput {
  title: string
  description: string
  payment: number
  category: string
  city: string
  address?: string
  deadline: string
}

export interface UpdateGigInput {
  title?: string
  description?: string
  payment?: number
  category?: string
  city?: string
  address?: string
  deadline?: string
}

export interface SubmitProofInput {
  proof_urls: string[]
}

export interface ApproveGigInput {
  transaction_signature: string
}

export interface DisputeGigInput {
  reason: string
}

export interface GigDetail extends Gig {
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

export interface UserGigsQuery {
  role?: 'poster' | 'worker'
  limit?: number
  offset?: number
}

export interface GigListQuery {
  status?: GigStatus
  city?: string
  category?: string
  limit?: number
  offset?: number
}
