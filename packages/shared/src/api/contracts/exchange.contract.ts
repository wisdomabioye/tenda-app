import type { Endpoint } from '../endpoint'
import type {
  ExchangeOfferSummary,
  ExchangeOfferDetail,
  CreateExchangeOfferInput,
  ExchangePublishInput,
  ExchangeAcceptInput,
  ExchangePaidInput,
  ExchangeConfirmInput,
  ExchangeDisputeInput,
  ExchangeResolveInput,
  ExchangeCancelInput,
  ExchangeListQuery,
  ExchangeEscrowRequest,
  ExchangeAcceptRequest,
  ExchangeSubmitProofRequest,
  ExchangeConfirmRequest,
  ExchangeCancelRequest,
  ExchangeDisputeRequest,
  ExchangeRefundRequest,
  ExchangeOffer,
  UserExchangeAccount,
  CreateUserExchangeAccountInput,
} from '../../types'
import type { EscrowResponse } from '../../types'
import type { PaginatedResponse } from '../../types/api'

export interface ExchangeContract {
  list:    Endpoint<'GET',    undefined,      undefined,                ExchangeListQuery, PaginatedResponse<ExchangeOfferSummary>>
  create:  Endpoint<'POST',   undefined,      CreateExchangeOfferInput, undefined,         ExchangeOfferDetail>
  get:     Endpoint<'GET',    { id: string }, undefined,                undefined,         ExchangeOfferDetail>
  publish: Endpoint<'POST',   { id: string }, ExchangePublishInput,     undefined,         ExchangeOfferDetail>
  cancel:  Endpoint<'DELETE', { id: string }, ExchangeCancelInput,     undefined,         ExchangeOffer>
  accept:  Endpoint<'POST',   { id: string }, ExchangeAcceptInput,      undefined,         ExchangeOfferDetail>
  paid:    Endpoint<'POST',   { id: string }, ExchangePaidInput,        undefined,         ExchangeOffer>
  confirm: Endpoint<'POST',   { id: string }, ExchangeConfirmInput,     undefined,         ExchangeOffer>
  dispute: Endpoint<'POST',   { id: string }, ExchangeDisputeInput,     undefined,         ExchangeOffer>
  resolve: Endpoint<'POST',   { id: string }, ExchangeResolveInput,     undefined,         ExchangeOffer>
}

export interface ExchangeAccountsContract {
  list:       Endpoint<'GET',    undefined,      undefined,                        undefined, UserExchangeAccount[]>
  create:     Endpoint<'POST',   undefined,      CreateUserExchangeAccountInput,   undefined, UserExchangeAccount>
  deactivate: Endpoint<'PATCH',  { id: string }, undefined,                        undefined, UserExchangeAccount>
}

export interface ExchangeBlockchainContract {
  createEscrow:  Endpoint<'POST', undefined, ExchangeEscrowRequest,      undefined, EscrowResponse>
  accept:        Endpoint<'POST', undefined, ExchangeAcceptRequest,       undefined, EscrowResponse>
  submitProof:   Endpoint<'POST', undefined, ExchangeSubmitProofRequest,  undefined, EscrowResponse>
  confirm:       Endpoint<'POST', undefined, ExchangeConfirmRequest,      undefined, EscrowResponse>
  cancel:        Endpoint<'POST', undefined, ExchangeCancelRequest,       undefined, EscrowResponse>
  dispute:       Endpoint<'POST', undefined, ExchangeDisputeRequest,      undefined, EscrowResponse>
  refund:        Endpoint<'POST', undefined, ExchangeRefundRequest,       undefined, EscrowResponse>
}
