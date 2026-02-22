import type { Endpoint } from '../endpoint'
import type {
  EscrowRequest,
  EscrowResponse,
  ApproveEscrowRequest,
  CancelEscrowRequest,
  AcceptGigRequest,
  SubmitProofRequest,
  RefundExpiredRequest,
  TransactionStatus,
} from '../../types'

export interface BlockchainContract {
  transaction:    Endpoint<'GET',  { signature: string }, undefined,             undefined, TransactionStatus>
  createEscrow:   Endpoint<'POST', undefined,             EscrowRequest,         undefined, EscrowResponse>
  approveEscrow:  Endpoint<'POST', undefined,             ApproveEscrowRequest,  undefined, EscrowResponse>
  cancelEscrow:   Endpoint<'POST', undefined,             CancelEscrowRequest,   undefined, EscrowResponse>
  acceptGig:      Endpoint<'POST', undefined,             AcceptGigRequest,      undefined, EscrowResponse>
  submitProof:    Endpoint<'POST', undefined,             SubmitProofRequest,    undefined, EscrowResponse>
  refundExpired:  Endpoint<'POST', undefined,             RefundExpiredRequest,  undefined, EscrowResponse>
}
