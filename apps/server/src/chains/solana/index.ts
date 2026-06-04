/**
 * Solana ChainAdapter — full Stage 0 implementation against the rewritten
 * escrow program (#29).
 *
 *   - `buildTx`: all 11 escrow actions, SOL/SPL instruction forking from
 *     on-chain state (`builders.ts`).
 *   - `verifyTx` / `fetchEscrowState`: event + account decoding (`verify.ts`).
 *   - `verifyAuthSig`: tweetnacl Ed25519 over the auth-message bytes.
 *   - `computeFee`: delegates to `lib/escrow.ts:computePlatformFee` — single
 *     source of truth for fee math across chains.
 *
 * Wallet + asset resolution are injected (`SolanaAdapterDeps`): until the
 * Stage-0 cutover the implementations read the legacy `users.wallet_address`
 * column and a config-driven asset map; at cutover they flip to
 * `user_wallets` / `assets` (schema-v2) with no adapter change.
 */

import { Program } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { ESCROW_IDL, type TendaEscrow } from '@tenda/shared/idl'
import { computePlatformFee } from '@server/lib/escrow'
import { createSolanaBuilders } from '@server/chains/solana/builders'
import { createSolanaRpc, commitmentFor, type SolanaRpc } from '@server/chains/solana/rpc'
import { createSolanaVerifier } from '@server/chains/solana/verify'
import type {
  AmountRaw,
  AssetId,
  ChainAdapter,
  ChainId,
  VerifyAuthSigArgs,
} from '@server/chains/types'

export interface SolanaAdapterDeps {
  /** user_id → the user's Solana wallet address (base58). */
  resolveWalletAddress(user_id: string): Promise<string>
  /** AssetId → SPL mint address (`null` = native SOL). Throws on unknown. */
  resolveAsset(asset: AssetId): Promise<{ token_address: string | null }>
  /** Test seam: replace the network-backed RPC with a fake. */
  rpc?: SolanaRpc
}

export interface SolanaAdapterArgs {
  /** CAIP-2 id, e.g. `'solana:mainnet'` or `'solana:devnet'`. */
  chain_id: ChainId
  /** RPC endpoint URL from `SOLANA_RPC_URL`. */
  rpc_url: string
  deps: SolanaAdapterDeps
}

export function solanaAdapter(args: SolanaAdapterArgs): ChainAdapter {
  const rpc =
    args.deps.rpc ?? createSolanaRpc({ rpc_url: args.rpc_url, chain_id: args.chain_id })

  // The Program instance encodes instructions only; its Connection is never
  // used for fetches (all reads go through `rpc`), so construction is free.
  const program = new Program<TendaEscrow>(ESCROW_IDL, {
    connection: new Connection(args.rpc_url, commitmentFor(args.chain_id)),
  })

  const builders = createSolanaBuilders({
    rpc,
    program,
    resolveWalletAddress: args.deps.resolveWalletAddress,
    resolveAsset: args.deps.resolveAsset,
  })
  const verifier = createSolanaVerifier({ rpc, chain_id: args.chain_id, program })

  return {
    namespace: 'solana',
    chain_id: args.chain_id,
    buildTx: builders.buildTx,
    verifyTx: verifier.verifyTx,
    fetchEscrowState: verifier.fetchEscrowState,

    async verifyAuthSig(a: VerifyAuthSigArgs): Promise<boolean> {
      return verifyEd25519({
        address: a.address,
        message: a.message,
        signature_b64: a.signature,
      })
    },

    computeFee(fee_args): AmountRaw {
      return computePlatformFee(fee_args)
    },
  }
}

// ---------- live primitives ---------------------------------------------

/**
 * Ed25519 signature check over the literal `message` bytes (Tenda's custom
 * auth template, NOT SIWS). Returns `false` for any decode failure rather
 * than throwing — callers translate `false` into `INVALID_SIGNATURE`.
 */
export function verifyEd25519(args: {
  address: string
  message: string
  signature_b64: string
}): boolean {
  try {
    const pk = new PublicKey(args.address).toBytes()
    const msg = new TextEncoder().encode(args.message)
    const sig = Buffer.from(args.signature_b64, 'base64')
    if (sig.length !== 64) return false
    return nacl.sign.detached.verify(msg, sig, pk)
  } catch {
    return false
  }
}
