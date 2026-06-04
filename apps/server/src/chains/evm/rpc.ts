/**
 * EVM RPC seam (stage-3-base.md § EVM adapter). Mirrors the SolanaRpc
 * pattern: a minimal interface the adapter consumes, with a viem-backed
 * implementation for production and in-memory fakes in tests.
 */

import {
  createPublicClient,
  http,
  type Abi,
  type PublicClient,
  type TransactionReceipt,
} from 'viem'
import { TENDA_ESCROW_EVM_ABI } from '@tenda/shared/abi'

/** The contract ABI, narrowed once at this boundary (same pattern as the
 *  Anchor IDL's `as TendaEscrow`). */
export const ESCROW_EVM_ABI = TENDA_ESCROW_EVM_ABI as Abi

export interface EvmReceiptLog {
  address: string
  data: `0x${string}`
  topics: `0x${string}`[]
}

export interface EvmReceipt {
  status: 'success' | 'reverted'
  block_number: bigint
  logs: EvmReceiptLog[]
}

/**
 * On-chain `escrows(bytes16)` tuple — field order matches the Solidity
 * struct exactly (the public mapping getter flattens it).
 */
export interface EvmEscrowTuple {
  escrow_id: `0x${string}`
  kind: number
  asset: `0x${string}`
  amount: bigint
  creator: `0x${string}`
  counterparty: `0x${string}`
  assigned_counterparty: `0x${string}`
  status: number
  accept_deadline: bigint
  completion_duration: bigint
  completion_deadline: bigint
  approval_deadline: bigint
  dispute_bond: bigint
  is_seeker: boolean
  raised_by: `0x${string}`
}

export interface EvmRpc {
  /** Null = transaction unknown to the node (not yet mined / dropped). */
  getTransactionReceipt(hash: `0x${string}`): Promise<EvmReceipt | null>
  getBlockNumber(): Promise<bigint>
  /** Null = escrow id never created (zero creator sentinel). */
  readEscrow(escrow_contract: `0x${string}`, escrow_id: `0x${string}`): Promise<EvmEscrowTuple | null>
}

export const DEFAULT_EVM_RPC_TIMEOUT_MS = 15_000

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function createEvmRpc(args: { rpc_url: string; timeout_ms?: number }): EvmRpc {
  const client: PublicClient = createPublicClient({
    transport: http(args.rpc_url, { timeout: args.timeout_ms ?? DEFAULT_EVM_RPC_TIMEOUT_MS }),
  })

  return {
    async getTransactionReceipt(hash) {
      let receipt: TransactionReceipt
      try {
        receipt = await client.getTransactionReceipt({ hash })
      } catch {
        // viem throws TransactionReceiptNotFoundError for unknown hashes —
        // the verify pipeline treats that as "not confirmed yet".
        return null
      }
      return {
        status: receipt.status,
        block_number: receipt.blockNumber,
        logs: receipt.logs.map((l) => ({
          address: l.address,
          data: l.data,
          topics: [...l.topics],
        })),
      }
    },

    async getBlockNumber() {
      return client.getBlockNumber()
    },

    async readEscrow(escrow_contract, escrow_id) {
      const result = (await client.readContract({
        address: escrow_contract,
        abi: ESCROW_EVM_ABI,
        functionName: 'escrows',
        args: [escrow_id],
      })) as readonly [
        `0x${string}`, // escrowId
        number, // kind
        `0x${string}`, // asset
        bigint, // amount
        `0x${string}`, // creator
        `0x${string}`, // counterparty
        `0x${string}`, // assignedCounterparty
        number, // status
        bigint, // acceptDeadline
        bigint, // completionDuration
        bigint, // completionDeadline
        bigint, // approvalDeadline
        bigint, // disputeBond
        boolean, // isSeeker
        `0x${string}`, // raisedBy
      ]
      if (result[4] === ZERO_ADDRESS) return null // never created
      return {
        escrow_id: result[0],
        kind: result[1],
        asset: result[2],
        amount: result[3],
        creator: result[4],
        counterparty: result[5],
        assigned_counterparty: result[6],
        status: result[7],
        accept_deadline: result[8],
        completion_duration: result[9],
        completion_deadline: result[10],
        approval_deadline: result[11],
        dispute_bond: result[12],
        is_seeker: result[13],
        raised_by: result[14],
      }
    },
  }
}

export { ZERO_ADDRESS }
