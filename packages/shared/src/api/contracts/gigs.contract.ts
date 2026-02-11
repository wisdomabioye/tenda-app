import type { Endpoint } from '../endpoint'
import type {
  Gig,
  GigDetail,
  CreateGigInput,
  UpdateGigInput,
  SubmitProofInput,
  ApproveGigInput,
  DisputeGigInput,
  GigListQuery,
  PaginatedResponse,
} from '../../types'

export interface GigsContract {
  list: Endpoint<'GET', undefined, undefined, GigListQuery, PaginatedResponse<Gig>>
  create: Endpoint<'POST', undefined, CreateGigInput, undefined, Gig>
  get: Endpoint<'GET', { id: string }, undefined, undefined, GigDetail>
  update: Endpoint<'PUT', { id: string }, UpdateGigInput, undefined, Gig>
  delete: Endpoint<'DELETE', { id: string }, undefined, undefined, Gig>
  accept: Endpoint<'POST', { id: string }, undefined, undefined, Gig>
  submit: Endpoint<'POST', { id: string }, SubmitProofInput, undefined, Gig>
  approve: Endpoint<'POST', { id: string }, ApproveGigInput, undefined, Gig>
  dispute: Endpoint<'POST', { id: string }, DisputeGigInput, undefined, Gig>
}
