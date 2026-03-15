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

export interface UsersContract {
  get:            Endpoint<'GET', { id: string }, undefined,        undefined,                  PublicUser>
  update:         Endpoint<'PUT', { id: string }, UpdateUserInput,  undefined,                  User>
  gigs:           Endpoint<'GET', { id: string }, undefined,        UserGigsQuery,              PaginatedResponse<Gig>>
  reviews:        Endpoint<'GET', { id: string }, undefined,        GetUserReviewsQuery,        PaginatedResponse<Review>>
  transactions:   Endpoint<'GET', { id: string }, undefined,        UserTransactionsQuery,      PaginatedResponse<UserTransaction>>
  exchangeOffers: Endpoint<'GET', { id: string }, undefined,        UserExchangeOffersQuery,    PaginatedResponse<ExchangeOfferSummary>>
}
