/**
 * Shared internals for the Solana tx builders: the dependency surface, the two
 * on-chain account lookups, and the pure encoding helpers. Split out of
 * builders.ts so the per-action instruction encoder (instructions.ts) and the
 * tx orchestrator (builders.ts) share one source for these.
 */

import { BN, type Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import bs58 from 'bs58'
import { ErrorCode } from '@tenda/shared'
import type { TendaEscrow } from '@tenda/shared/idl'
import { AppError } from '@server/lib/errors'
import { uuidToBytes } from '@server/chains/ids'
import {
  decodeEscrowAccount,
  decodePlatformStateAccount,
  escrowPda,
  platformPda,
  type EscrowAccount,
  type PlatformStateAccount,
} from '@server/chains/solana/pdas'
import type { SolanaRpc } from '@server/chains/solana/rpc'
import { isAmountRaw, type AmountRaw, type AssetId } from '@server/chains/types'

export interface SolanaBuilderDeps {
  rpc: SolanaRpc
  /** Anchor program used for instruction encoding only (no fetches). */
  program: Program<TendaEscrow>
  /** user_id → the user's Solana wallet address. */
  resolveWalletAddress(user_id: string): Promise<string>
  /** AssetId → token address (`null` = native SOL). Throws on unknown asset. */
  resolveAsset(asset: AssetId): Promise<{ token_address: string | null }>
}

// ---- on-chain account lookups ---------------------------------------------

export async function fetchEscrow(
  deps: SolanaBuilderDeps,
  escrow_id: string,
): Promise<{ escrowAddr: PublicKey; idBytes: Buffer; escrow: EscrowAccount }> {
  const idBytes = uuidToBytes(escrow_id)
  const escrowAddr = escrowPda(idBytes)
  const data = await deps.rpc.getAccountData(escrowAddr.toBase58())
  if (data === null) {
    throw new AppError(
      404,
      ErrorCode.NOT_FOUND,
      `escrow ${escrow_id} has no on-chain account at ${escrowAddr.toBase58()}`,
    )
  }
  return { escrowAddr, idBytes, escrow: decodeEscrowAccount(deps.program.coder, data) }
}

export async function fetchPlatformState(deps: SolanaBuilderDeps): Promise<PlatformStateAccount> {
  const addr = platformPda().toBase58()
  const data = await deps.rpc.getAccountData(addr)
  if (data === null) {
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, `platform state account ${addr} not initialized`)
  }
  return decodePlatformStateAccount(deps.program.coder, data)
}

// ---- pure helpers ----------------------------------------------------------

export const WINNER_ARG = {
  creator: { creator: {} },
  counterparty: { counterparty: {} },
  split: { split: {} },
} as const

export function isNativeSol(escrow: EscrowAccount): boolean {
  return escrow.asset.equals(SystemProgram.programId)
}

export function counterpartyOrThrow(escrow: EscrowAccount): PublicKey {
  if (escrow.counterparty === null) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_WRONG_STATUS,
      'escrow has no counterparty on-chain; action requires an accepted escrow',
    )
  }
  return escrow.counterparty
}

export function toBn(value: AmountRaw, field: string): BN {
  if (!isAmountRaw(value)) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, `${field} is not a canonical AmountRaw`)
  }
  return new BN(value)
}

/** Solana proof hashes travel base58 (types.ts SubmitProofPayload). */
export function decodeProofHash(proof_hash: string): number[] {
  let bytes: Uint8Array
  try {
    bytes = bs58.decode(proof_hash)
  } catch {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'proof_hash is not valid base58')
  }
  if (bytes.length !== 32) {
    throw new AppError(
      422,
      ErrorCode.VALIDATION_ERROR,
      `proof_hash must decode to 32 bytes, got ${bytes.length}`,
    )
  }
  return Array.from(bytes)
}
