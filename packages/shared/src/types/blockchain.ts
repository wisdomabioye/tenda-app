export interface EscrowRequest {
  gig_id: string
}

export interface EscrowResponse {
  transaction: string
}

export interface ApproveEscrowRequest {
  gig_id: string
}

export interface CancelEscrowRequest {
  gig_id: string
}

export interface AcceptGigRequest {
  gig_id: string
}

export interface SubmitProofRequest {
  gig_id: string
}

export interface RefundExpiredRequest {
  gig_id: string
}

export interface DisputeGigRequest {
  gig_id: string
  reason: string
}

export interface WithdrawEarningsRequest {
  amount_lamports: number
}

export interface CreateUserAccountRequest {}

export interface TransactionStatus {
  signature: string
  status: 'confirmed' | 'finalized' | 'failed' | 'not_found'
  block_time?: number
}
