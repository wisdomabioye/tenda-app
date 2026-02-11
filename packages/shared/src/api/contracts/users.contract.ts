import type { Endpoint } from '../endpoint'
import type {
  User,
  PublicUser,
  UpdateUserInput,
  Gig,
  UserGigsQuery,
  PaginatedResponse,
} from '../../types'

export interface UsersContract {
  get: Endpoint<'GET', { id: string }, undefined, undefined, PublicUser>
  update: Endpoint<'PUT', { id: string }, UpdateUserInput, undefined, User>
  gigs: Endpoint<'GET', { id: string }, undefined, UserGigsQuery, PaginatedResponse<Gig>>
}
