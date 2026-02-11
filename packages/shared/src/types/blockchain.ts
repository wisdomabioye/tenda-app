export interface EscrowRequest {
  gig_id: string
  amount: number
  payer_address: string
}

export interface EscrowResponse {
  transaction: string
  escrow_address: string
}

export interface TransactionStatus {
  signature: string
  status: 'confirmed' | 'finalized' | 'failed' | 'not_found'
  block_time?: number
}
