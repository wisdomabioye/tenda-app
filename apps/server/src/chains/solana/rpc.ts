/**
 * Thin RPC seam for the Solana adapter.
 *
 * `SolanaRpc` is the complete network surface the adapter touches, builders
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
  /**
   * Raw account data plus its OWNING program. Null = account does not exist.
   *
   * The owner rides along because Anchor's account discriminator is derived
   * from the account NAME, so it is identical across program generations: an
   * account left behind by a superseded program deserialises perfectly as
   * current state. Data alone cannot tell the two apart; only the owner can.
   */
  getAccount(address: string): Promise<{ data: Buffer; owner: string } | null>
  /**
   * Recent signatures touching an address (newest first), the polling
   * listener's feed. Failed txs are included; verify-tx classifies them.
   */
  getSignaturesForAddress(
    address: string,
    opts: { limit: number },
  ): Promise<Array<{ signature: string; slot: number }>>
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

/**
 * Minimal `Connection` surface the wrapper consumes. Tests inject a fake
 * against this port (no web3 Connection, no network); `createSolanaRpc`
 * builds the real Connection, owning commitment + PublicKey construction,
 * and adapts it here.
 */
export interface SolanaConnectionPort {
  getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }>
  getTransaction(
    tx_ref: string,
  ): Promise<{ meta: { err: unknown; logMessages?: string[] | null } | null } | null>
  getAccountInfo(address: string): Promise<{ data: Buffer; owner: string } | null>
  getSignaturesForAddress(
    address: string,
    opts: { limit: number },
  ): Promise<Array<{ signature: string; slot: number }>>
}

/**
 * Wrap a connection port into the SolanaRpc the adapter consumes, the
 * testable unit: the per-call timeout race plus response→interface mapping.
 */
export function solanaRpcFromConnection(
  conn: SolanaConnectionPort,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
): SolanaRpc {
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
      const r = await withTimeout('getLatestBlockhash', conn.getLatestBlockhash())
      return { blockhash: r.blockhash, last_valid_block_height: r.lastValidBlockHeight }
    },

    async getTransaction(tx_ref) {
      const tx = await withTimeout(`getTransaction(${tx_ref})`, conn.getTransaction(tx_ref))
      if (tx === null) return null
      const err = tx.meta?.err ?? null
      return {
        failed: err !== null,
        failure_reason: err === null ? null : JSON.stringify(err),
        log_messages: tx.meta?.logMessages ?? [],
      }
    },

    async getAccount(address) {
      const info = await withTimeout(`getAccountInfo(${address})`, conn.getAccountInfo(address))
      return info === null ? null : { data: Buffer.from(info.data), owner: info.owner }
    },

    async getSignaturesForAddress(address, opts) {
      const infos = await withTimeout(
        `getSignaturesForAddress(${address})`,
        conn.getSignaturesForAddress(address, { limit: opts.limit }),
      )
      return infos.map((i) => ({ signature: i.signature, slot: i.slot }))
    },
  }
}

export function createSolanaRpc(args: {
  rpc_url: string
  chain_id: ChainId
  timeout_ms?: number
}): SolanaRpc {
  const commitment = commitmentFor(args.chain_id)
  const connection = new Connection(args.rpc_url, commitment)
  const port: SolanaConnectionPort = {
    getLatestBlockhash: () => connection.getLatestBlockhash(commitment),
    getTransaction: (tx_ref) =>
      connection.getTransaction(tx_ref, {
        maxSupportedTransactionVersion: 0,
        commitment: commitment === 'confirmed' ? 'confirmed' : 'finalized',
      }),
    // web3.js hands back `owner` as a PublicKey; the port speaks base58 so the
    // seam stays comparable to IDL/config addresses without importing web3.
    getAccountInfo: async (address) => {
      const info = await connection.getAccountInfo(new PublicKey(address), commitment)
      return info === null ? null : { data: info.data, owner: info.owner.toBase58() }
    },
    getSignaturesForAddress: (address, opts) =>
      connection.getSignaturesForAddress(new PublicKey(address), { limit: opts.limit }),
  }
  return solanaRpcFromConnection(port, args.timeout_ms ?? DEFAULT_RPC_TIMEOUT_MS)
}
