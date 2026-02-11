import type { Endpoint } from '../endpoint'
import type {
  EscrowRequest,
  EscrowResponse,
  TransactionStatus,
} from '../../types'

export interface BlockchainContract {
  transaction: Endpoint<'GET', { signature: string }, undefined, undefined, TransactionStatus>
  createEscrow: Endpoint<'POST', undefined, EscrowRequest, undefined, EscrowResponse>
}
