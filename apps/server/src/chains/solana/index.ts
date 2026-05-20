/**
 * Solana ChainAdapter — Stage 0.
 *
 * What works today:
 *   - `verifyAuthSig`: tweetnacl Ed25519 over the auth-message bytes.
 *   - `computeFee`: delegates to `lib/escrow.ts:computePlatformFee` — single
 *     source of truth for fee math across chains.
 *
 * What's deferred to #29 (Anchor program rewrite):
 *   - `buildTx` for the 11 escrow actions — needs the new IDL.
 *   - `verifyTx` + event decoders — needs `emit_cpi!` decode against new IDL.
 *   - `fetchEscrowState` — needs new Escrow account layout.
 *
 * Deferred to Stage 2 (listeners):
 *   - `RpcProvider` impl for direct-RPC tx status checks (reconciliation).
 *
 * Stubs throw `AppError(501, INTERNAL_ERROR, ...)` so callers fail loud
 * rather than silently no-op.
 */

import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { computePlatformFee } from '@server/lib/escrow'
import type {
  AmountRaw,
  BuildTxArgs,
  ChainAdapter,
  ChainId,
  DecodedEvent,
  UnsignedTx,
  VerifiedTx,
  VerifyAuthSigArgs,
  VerifyTxArgs,
} from '@server/chains/types'

export interface SolanaAdapterArgs {
  /** CAIP-2 id, e.g. `'solana:mainnet'` or `'solana:devnet'`. */
  chain_id: ChainId
  /** RPC endpoint URL from `SOLANA_RPC_URL`. */
  rpc_url: string
  /** Anchor program ID from `SOLANA_PROGRAM_ID`. */
  program_id: string
}

export function solanaAdapter(args: SolanaAdapterArgs): ChainAdapter {
  // args.rpc_url + args.program_id are held for buildTx/verifyTx wiring at
  // #29; not read by any Stage-0-live method.
  return {
    namespace: 'solana',
    chain_id: args.chain_id,

    async buildTx(_args: BuildTxArgs): Promise<UnsignedTx> {
      throw notImplemented('buildTx')
    },

    async verifyTx(_tx_ref: string, _args: VerifyTxArgs): Promise<VerifiedTx> {
      throw notImplemented('verifyTx')
    },

    async verifyAuthSig(a: VerifyAuthSigArgs): Promise<boolean> {
      return verifyEd25519({
        address: a.address,
        message: a.message,
        signature_b64: a.signature,
      })
    },

    async fetchEscrowState(_escrow_ref: string): Promise<DecodedEvent | null> {
      throw notImplemented('fetchEscrowState')
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

// ---------- internals ---------------------------------------------------

function notImplemented(method: string): AppError {
  return new AppError(
    501,
    ErrorCode.INTERNAL_ERROR,
    `solana.${method}: not implemented — lands with Anchor program rewrite (#29)`,
  )
}
