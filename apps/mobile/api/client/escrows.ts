/**
 * v2 escrow primitive: every on-chain action returns an unsigned tx the wallet
 * signs, and the broadcast result is reported via `blockchain.clientPing`.
 * Proofs, review and the off-chain assignment release are satellites.
 */
import {
  apiRoutes,
  type AssignWorkerBody,
  type AddEscrowProofsBody,
  type CreateEscrowApiBody,
  type CreateEscrowApiResponse,
  type DisputeEscrowApiBody,
  type DisputeMessage,
  type DisputeThreadResponse,
  type EscrowActionResponse,
  type EscrowProof,
  type ReleaseAssignmentResponse,
  type ResolveEscrowApiBody,
  type Review,
  type ReviewInput,
  type SendDisputeMessageBody,
  type SubmitEscrowProofBody,
} from '@tenda/shared'
import { request } from '../request'
import { TX_BUILD_TIMEOUT_MS } from './timeouts'

const { escrows } = apiRoutes

export const escrowsApi = {
  create: (body: CreateEscrowApiBody) =>
    request<CreateEscrowApiResponse>('POST', escrows.create, { body }),
  // Publish path for drafts that never got (or lost) their unsigned tx.
  buildCreate: (params: { id: string }) =>
    request<CreateEscrowApiResponse>('POST', escrows.buildCreate, { params }),
  accept: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.accept, { params }),
  decline: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.decline, { params }),
  /** Approval mode: the POSTER signs this one, naming the worker they picked. */
  assign: (params: { id: string }, body: AssignWorkerBody) =>
    request<EscrowActionResponse>('POST', escrows.assign, { params, body }),
  /** Approval mode: the poster withdraws an assignment inside the window. */
  unassign: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.unassign, { params }),
  /**
   * The assigned worker says they are not available. OFF-CHAIN — they signed
   * nothing to be assigned, so there is no unsigned tx here and it returns a
   * stamp rather than an `EscrowActionResponse`.
   */
  release: (params: { id: string }) =>
    request<ReleaseAssignmentResponse>('POST', escrows.release, { params }),
  submit: (params: { id: string }, body: SubmitEscrowProofBody) =>
    request<EscrowActionResponse>('POST', escrows.submit, { params, body }),
  approve: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.approve, { params }),
  claim: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.claim, { params }),
  cancel: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.cancel, { params }),
  refund: (params: { id: string }) =>
    request<EscrowActionResponse>('POST', escrows.refund, { params }),
  // Dispute is the one escrow transition whose EVM buildTx reads on-chain
  // state (the bond's asset), so it inherits the RPC timeout budget.
  dispute: (params: { id: string }, body: DisputeEscrowApiBody) =>
    request<EscrowActionResponse>('POST', escrows.dispute, {
      params,
      body,
      timeout: TX_BUILD_TIMEOUT_MS,
    }),
  // CO7 mediation thread, one shared conversation per dispute.
  disputeThread: (params: { id: string }, query?: { after?: string }) =>
    request<DisputeThreadResponse>('GET', escrows.disputeMessages, { params, query }),
  sendDisputeMessage: (params: { id: string }, body: SendDisputeMessageBody) =>
    request<DisputeMessage>('POST', escrows.sendDisputeMessage, { params, body }),
  resolve: (params: { id: string }, body: ResolveEscrowApiBody) =>
    request<EscrowActionResponse>('POST', escrows.resolve, { params, body }),
  delete: (params: { id: string }) =>
    request<{ deleted: true }>('DELETE', escrows.delete, { params }),
  proofs: (params: { id: string }) => request<EscrowProof[]>('GET', escrows.proofs, { params }),
  addProofs: (params: { id: string }, body: AddEscrowProofsBody) =>
    request<EscrowProof[]>('POST', escrows.addProofs, { params, body }),
  review: (params: { id: string }, body: ReviewInput) =>
    request<Review>('POST', escrows.review, { params, body }),
}
