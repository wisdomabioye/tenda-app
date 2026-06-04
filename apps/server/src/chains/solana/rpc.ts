/**
 * Thin RPC seam for the Solana adapter.
 *
 * `SolanaRpc` is the complete network surface the adapter touches — builders
 * and verifiers depend on this interface, never on `Connection` directly, so
 * adapter tests run fully offline against a fake (testing-strategy.md:
 * "no real network in unit / route tests").
 */

import { Connection, PublicKey, type Commitment } from '@solana/web3.js'
import type { ChainId } from '@server/chains/types'

/** Minimal decoded view of a fetched transaction. */
export interface SolanaTxResult {
  /** Whether the runtime recorded an execution error. */
  failed: boolean
  /** Stringified runtime error when `failed`; null otherwise. */
  failure_reason: string | null
  /** Program log messages (event payloads decode from these). */
  log_messages: string[]
}

export interface SolanaRpc {
  getLatestBlockhash(): Promise<{ blockhash: string; last_valid_block_height: number }>
  /** Null = signature unknown / not yet confirmed at the required commitment. */
  getTransaction(tx_ref: string): Promise<SolanaTxResult | null>
  /** Raw account data. Null = account does not exist. */
  getAccountData(address: string): Promise<Buffer | null>
}

/** Default per-call timeout. Override via `createSolanaRpc` args. */
export const DEFAULT_RPC_TIMEOUT_MS = 15_000

/**
 * Commitment policy (recorded decision): devnet accepts `'confirmed'`,
 * mainnet requires `'finalized'`.
 */
export function commitmentFor(chain_id: ChainId): Commitment {
  return chain_id === 'solana:devnet' ? 'confirmed' : 'finalized'
}

export function createSolanaRpc(args: {
  rpc_url: string
  chain_id: ChainId
  timeout_ms?: number
}): SolanaRpc {
  const commitment = commitmentFor(args.chain_id)
  const timeoutMs = args.timeout_ms ?? DEFAULT_RPC_TIMEOUT_MS
  const connection = new Connection(args.rpc_url, commitment)

  function withTimeout<T>(label: string, p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`solana rpc timeout after ${timeoutMs}ms: ${label}`)),
        timeoutMs,
      )
      p.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        },
      )
    })
  }

  return {
    async getLatestBlockhash() {
      const r = await withTimeout('getLatestBlockhash', connection.getLatestBlockhash(commitment))
      return { blockhash: r.blockhash, last_valid_block_height: r.lastValidBlockHeight }
    },

    async getTransaction(tx_ref) {
      const tx = await withTimeout(
        `getTransaction(${tx_ref})`,
        connection.getTransaction(tx_ref, {
          maxSupportedTransactionVersion: 0,
          commitment: commitment === 'confirmed' ? 'confirmed' : 'finalized',
        }),
      )
      if (tx === null) return null
      const err = tx.meta?.err ?? null
      return {
        failed: err !== null,
        failure_reason: err === null ? null : JSON.stringify(err),
        log_messages: tx.meta?.logMessages ?? [],
      }
    },

    async getAccountData(address) {
      const info = await withTimeout(
        `getAccountInfo(${address})`,
        connection.getAccountInfo(new PublicKey(address), commitment),
      )
      return info === null ? null : Buffer.from(info.data)
    },
  }
}
