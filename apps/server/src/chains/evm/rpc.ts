/**
 * EVM RPC seam (stage-3-base.md § EVM adapter). Mirrors the SolanaRpc
 * pattern: a minimal interface the adapter consumes, with a viem-backed
 * implementation for production and in-memory fakes in tests.
 */

import { createPublicClient, fallback, http, type Abi } from 'viem'
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
 * On-chain `escrows(bytes16)` tuple, field order matches the Solidity
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

/** Live token facts an EIP-2612 permit payload needs (read per request). */
export interface EvmPermitFacts {
  name: string
  nonce: bigint
  domain_separator: `0x${string}`
}

/** A mined log's position, all the polling listener needs to enqueue it. */
export interface EvmLogRef {
  tx_hash: `0x${string}`
  block_number: bigint
}

export interface EvmRpc {
  /** Null = transaction unknown to the node (not yet mined / dropped). */
  getTransactionReceipt(hash: `0x${string}`): Promise<EvmReceipt | null>
  getBlockNumber(): Promise<bigint>
  /**
   * Every mined log the contract emitted in [from_block, to_block], ascending
   * block order. Reverted txs emit no logs, so only real state changes appear.
   */
  getLogRefs(
    contract: `0x${string}`,
    from_block: bigint,
    to_block: bigint,
  ): Promise<EvmLogRef[]>
  /** Null = escrow id never created (zero creator sentinel). */
  readEscrow(escrow_contract: `0x${string}`, escrow_id: `0x${string}`): Promise<EvmEscrowTuple | null>
  /** name() + nonces(owner) + DOMAIN_SEPARATOR() off an EIP-2612 token. */
  readPermitFacts(token: `0x${string}`, owner: `0x${string}`): Promise<EvmPermitFacts>
}

export const DEFAULT_EVM_RPC_TIMEOUT_MS = 15_000

/**
 * Per-endpoint attempt timeout when a fallback RPC is configured. Failover IS
 * the retry (two independent providers beat re-hitting a degraded one), so
 * each transport gets one bounded attempt: worst case 2 × 6s = 12s, inside
 * the mobile client's 20s tx-build budget (TX_BUILD_TIMEOUT_MS) — a dead
 * primary degrades to ~6s + fallback latency instead of an aborted request.
 */
export const FALLBACK_EVM_RPC_TIMEOUT_MS = 6_000

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Minimal EIP-2612 read surface (subset every permit token implements). */
const ERC20_PERMIT_READS_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const satisfies Abi

/**
 * Minimal viem-client surface the wrapper consumes. Tests inject a fake
 * against this port (no network, no viem client construction);
 * `createEvmRpc` builds the real PublicClient and adapts it.
 */
export interface EvmClientReceipt {
  status: 'success' | 'reverted'
  blockNumber: bigint
  logs: ReadonlyArray<{ address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }>
}

export interface EvmClientPort {
  /** Throws when the hash is unknown, the wrapper maps that to `null`. */
  getTransactionReceipt(hash: `0x${string}`): Promise<EvmClientReceipt>
  getBlockNumber(): Promise<bigint>
  /** viem getLogs shape; transactionHash is null only for pending logs. */
  getLogs(args: {
    address: `0x${string}`
    fromBlock: bigint
    toBlock: bigint
  }): Promise<ReadonlyArray<{ transactionHash: `0x${string}` | null; blockNumber: bigint | null }>>
  readContract(args: {
    address: `0x${string}`
    abi: Abi
    functionName: string
    args: readonly unknown[]
  }): Promise<unknown>
}

/** Wrap a client port into the EvmRpc the adapter consumes (the testable unit). */
export function evmRpcFromClient(client: EvmClientPort): EvmRpc {
  return {
    async getTransactionReceipt(hash) {
      let receipt: EvmClientReceipt
      try {
        receipt = await client.getTransactionReceipt(hash)
      } catch {
        // viem throws TransactionReceiptNotFoundError for unknown hashes,
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

    async getLogRefs(contract, from_block, to_block) {
      const logs = await client.getLogs({ address: contract, fromBlock: from_block, toBlock: to_block })
      const refs: EvmLogRef[] = []
      for (const log of logs) {
        // Pending logs carry null position fields; a bounded mined-range query
        // shouldn't return them, but never let one through as a fake ref.
        if (log.transactionHash === null || log.blockNumber === null) continue
        refs.push({ tx_hash: log.transactionHash, block_number: log.blockNumber })
      }
      return refs.sort((a, b) => (a.block_number < b.block_number ? -1 : a.block_number > b.block_number ? 1 : 0))
    },

    async readPermitFacts(token, owner) {
      const [name, nonce, domain_separator] = await Promise.all([
        client.readContract({ address: token, abi: ERC20_PERMIT_READS_ABI, functionName: 'name', args: [] }),
        client.readContract({ address: token, abi: ERC20_PERMIT_READS_ABI, functionName: 'nonces', args: [owner] }),
        client.readContract({
          address: token,
          abi: ERC20_PERMIT_READS_ABI,
          functionName: 'DOMAIN_SEPARATOR',
          args: [],
        }),
      ])
      return {
        name: name as string,
        nonce: nonce as bigint,
        domain_separator: domain_separator as `0x${string}`,
      }
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

export function createEvmRpc(args: {
  rpc_url: string
  /** Secondary endpoint; presence switches to the failover transport. */
  rpc_url_fallback?: string
  timeout_ms?: number
}): EvmRpc {
  const transport =
    args.rpc_url_fallback !== undefined
      ? fallback(
          [
            http(args.rpc_url, {
              timeout: args.timeout_ms ?? FALLBACK_EVM_RPC_TIMEOUT_MS,
              retryCount: 0,
            }),
            http(args.rpc_url_fallback, {
              timeout: args.timeout_ms ?? FALLBACK_EVM_RPC_TIMEOUT_MS,
              retryCount: 0,
            }),
          ],
          // No aggregate retries either: both providers failing once is a real
          // outage, surface it inside the client's budget rather than stacking
          // delays past it. rank stays off, the primary is always tried first.
          { retryCount: 0 },
        )
      : http(args.rpc_url, { timeout: args.timeout_ms ?? DEFAULT_EVM_RPC_TIMEOUT_MS })
  const vc = createPublicClient({
    transport,
    // Confirmation counting needs a FRESH head: viem's default ~4s
    // blockNumber cache can lag the receipt's block (a stale head only
    // delays confirmation in prod, but reads negative on instant-mining
    // nodes). Never cache.
    cacheTime: 0,
  })
  const client: EvmClientPort = {
    getTransactionReceipt: (hash) => vc.getTransactionReceipt({ hash }),
    getBlockNumber: () => vc.getBlockNumber(),
    getLogs: (a) => vc.getLogs({ address: a.address, fromBlock: a.fromBlock, toBlock: a.toBlock }),
    // viem's readContract param is ABI-generic; the loose port shape needs a
    // boundary cast (the result is already cast to the tuple downstream).
    readContract: (a) => vc.readContract(a as Parameters<typeof vc.readContract>[0]),
  }
  return evmRpcFromClient(client)
}

export { ZERO_ADDRESS }
