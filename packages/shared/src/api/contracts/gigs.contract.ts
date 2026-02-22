import type { Endpoint } from '../endpoint'
import type {
  Gig,
  GigDetail,
  GigProof,
  GigTransaction,
  CreateGigInput,
  UpdateGigInput,
  PublishGigInput,
  CancelGigInput,
  AcceptGigInput,
  SubmitProofInput,
  ApproveGigInput,
  RefundExpiredInput,
  DisputeGigInput,
  ResolveDisputeInput,
  GigListQuery,
  PaginatedResponse,
} from '../../types'
import type { Review, ReviewInput } from '../../types/review'

export interface GigsContract {
  list:         Endpoint<'GET',    undefined,      undefined,           GigListQuery,  PaginatedResponse<Gig>>
  create:       Endpoint<'POST',   undefined,      CreateGigInput,      undefined,     Gig>
  get:          Endpoint<'GET',    { id: string }, undefined,           undefined,     GigDetail>
  update:       Endpoint<'PATCH',  { id: string }, UpdateGigInput,      undefined,     Gig>   // draft only
  delete:       Endpoint<'DELETE', { id: string }, CancelGigInput,      undefined,     Gig>
  publish:      Endpoint<'POST',   { id: string }, PublishGigInput,     undefined,     Gig>   // draft → open
  accept:       Endpoint<'POST',   { id: string }, AcceptGigInput,      undefined,     Gig>
  submit:       Endpoint<'POST',   { id: string }, SubmitProofInput,    undefined,     GigProof[]>
  approve:      Endpoint<'POST',   { id: string }, ApproveGigInput,     undefined,     Gig>
  dispute:      Endpoint<'POST',   { id: string }, DisputeGigInput,     undefined,     Gig>
  resolve:      Endpoint<'POST',   { id: string }, ResolveDisputeInput, undefined,     Gig>
  refund:       Endpoint<'POST',   { id: string }, RefundExpiredInput,  undefined,     Gig>
  review:       Endpoint<'POST',   { id: string }, ReviewInput,         undefined,     Review>
  transactions: Endpoint<'GET',    { id: string }, undefined,           undefined,     GigTransaction[]>
}
