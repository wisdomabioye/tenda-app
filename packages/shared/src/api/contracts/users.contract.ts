import type { Endpoint } from '../endpoint'
import type {
  User,
  PublicUser,
  UpdateUserInput,
  Gig,
  UserGigsQuery,
  UserTransactionsQuery,
  PaginatedResponse,
  UserTransaction,
  ExchangeOfferSummary,
  UserExchangeOffersQuery,
} from '../../types'
import type { Review, GetUserReviewsQuery } from '../../types/review'
import type { LinkedWallet } from './auth.contract'

// ---------- Stage 1: /v1/users/me (#38) -----------------------------------

/**
 * The v2 public column set GET/PATCH /v1/users/me returns — a subset of
 * the physical `users` row (no phone_e164, no wallet_address). Dates are
 * ISO-serialized by Fastify.
 */
export interface MeUser {
  id: string
  first_name: string
  last_name: string
  bio: string | null
  avatar_url: string | null
  country: string | null
  city: string | null
  phone_verified_at: string | null
  role: string
  is_seeker: boolean
  advanced_mode_enabled: boolean
  created_at: string | null
}

export interface MeResponse {
  user: MeUser
  wallets: LinkedWallet[]
  /** first_name AND last_name set — mirrors requireProfileComplete. */
  profile_complete: boolean
}

/** PATCH /v1/users/me — phone changes ride the OTP routes, never here. */
export interface UpdateMeInput {
  first_name?: string
  last_name?: string
  country?: string
  city?: string
  bio?: string
  avatar_url?: string
  is_seeker?: boolean
}

export interface UpdateMeResponse {
  user: MeUser
  profile_complete: boolean
}

export interface UsersContract {
  me:             Endpoint<'GET', undefined, undefined,        undefined,                  MeResponse>
  updateMe:       Endpoint<'PATCH', undefined, UpdateMeInput,  undefined,                  UpdateMeResponse>
  get:            Endpoint<'GET', { id: string }, undefined,        undefined,                  PublicUser>
  update:         Endpoint<'PUT', { id: string }, UpdateUserInput,  undefined,                  User>
  gigs:           Endpoint<'GET', { id: string }, undefined,        UserGigsQuery,              PaginatedResponse<Gig>>
  reviews:        Endpoint<'GET', { id: string }, undefined,        GetUserReviewsQuery,        PaginatedResponse<Review>>
  transactions:   Endpoint<'GET', { id: string }, undefined,        UserTransactionsQuery,      PaginatedResponse<UserTransaction>>
  exchangeOffers: Endpoint<'GET', { id: string }, undefined,        UserExchangeOffersQuery,    PaginatedResponse<ExchangeOfferSummary>>
}
