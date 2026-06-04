/**
 * Unsigned-transaction builders for every escrow action.
 *
 * Asset forking (SOL vs SPL instruction variants) is derived from on-chain
 * state: the escrow PDA is a pure function of the DB `escrow_id`, so any
 * post-create action fetches the account and branches on `asset`. Only
 * `createEscrow` needs the asset registry (via the injected resolver).
 *
 * No network I/O outside the injected `SolanaRpc` — the Anchor `Program`
 * instance is used purely for instruction encoding.
 */

import { BN, type Program } from '@coral-xyz/anchor'
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
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
  tokenVaultPda,
  vaultPda,
  type EscrowAccount,
  type PlatformStateAccount,
} from '@server/chains/solana/pdas'
import type { SolanaRpc } from '@server/chains/solana/rpc'
import {
  isAmountRaw,
  type AmountRaw,
  type AssetId,
  type BuildTxArgs,
  type UnsignedTx,
} from '@server/chains/types'

export interface SolanaBuilderDeps {
  rpc: SolanaRpc
  /** Anchor program used for instruction encoding only (no fetches). */
  program: Program<TendaEscrow>
  /** user_id → the user's Solana wallet address. */
  resolveWalletAddress(user_id: string): Promise<string>
  /** AssetId → token address (`null` = native SOL). Throws on unknown asset. */
  resolveAsset(asset: AssetId): Promise<{ token_address: string | null }>
}

export function createSolanaBuilders(deps: SolanaBuilderDeps) {
  async function buildTx(args: BuildTxArgs): Promise<UnsignedTx> {
    const wallet = new PublicKey(await deps.resolveWalletAddress(args.user_id))
    const ix = await buildInstruction(args, wallet)
    const { blockhash, last_valid_block_height } = await deps.rpc.getLatestBlockhash()
    const message = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message()
    const tx = new VersionedTransaction(message)
    return {
      kind: 'solana-tx',
      tx_base64: Buffer.from(tx.serialize()).toString('base64'),
      recent_blockhash: blockhash,
      last_valid_block_height,
    }
  }

  async function buildInstruction(
    args: BuildTxArgs,
    wallet: PublicKey,
  ): Promise<TransactionInstruction> {
    switch (args.action) {
      case 'createEscrow': {
        const p = args.payload
        const idBytes = uuidToBytes(p.escrow_id)
        const asset = await deps.resolveAsset(p.asset)
        const ixArgs = {
          escrowId: Array.from(idBytes),
          kind: p.kind === 'gig' ? { gig: {} } : { exchange: {} },
          amount: toBn(p.amount_raw, 'amount_raw'),
          assignedCounterparty:
            p.assigned_counterparty_address !== undefined
              ? new PublicKey(p.assigned_counterparty_address)
              : null,
          acceptDeadline: new BN(p.accept_deadline_unix),
          completionDurationSeconds: new BN(p.completion_duration_seconds),
          disputeBond: toBn(p.dispute_bond_raw, 'dispute_bond_raw'),
          isSeeker: p.is_seeker,
        }
        if (asset.token_address === null) {
          return deps.program.methods
            .createEscrowSol(ixArgs)
            .accountsPartial({
              escrow: escrowPda(idBytes),
              vault: vaultPda(idBytes),
              creator: wallet,
              systemProgram: SystemProgram.programId,
            })
            .instruction()
        }
        const mint = new PublicKey(asset.token_address)
        return deps.program.methods
          .createEscrowSpl(ixArgs)
          .accountsPartial({
            escrow: escrowPda(idBytes),
            vaultTokenAccount: tokenVaultPda(idBytes),
            mint,
            creatorTokenAccount: getAssociatedTokenAddressSync(mint, wallet),
            creator: wallet,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      }

      case 'acceptEscrow':
      case 'declineAssignedEscrow': {
        const { escrowAddr } = await fetchEscrow(args.payload.escrow_id)
        const method =
          args.action === 'acceptEscrow'
            ? deps.program.methods.acceptEscrow()
            : deps.program.methods.declineAssignedEscrow()
        return method
          .accountsPartial({
            escrow: escrowAddr,
            platformState: platformPda(),
            signer: wallet,
          })
          .instruction()
      }

      case 'submitProof': {
        const { escrowAddr } = await fetchEscrow(args.payload.escrow_id)
        return deps.program.methods
          .submitProof(decodeProofHash(args.payload.proof_hash))
          .accountsPartial({
            escrow: escrowAddr,
            platformState: platformPda(),
            signer: wallet,
          })
          .instruction()
      }

      case 'approveCompletion':
      case 'claimStalledPayment':
      case 'reclaimAbandoned': {
        const { escrowAddr, idBytes, escrow } = await fetchEscrow(args.payload.escrow_id)
        const platform = await fetchPlatformState()
        const counterparty = counterpartyOrThrow(escrow)
        if (isNativeSol(escrow)) {
          const accounts = {
            escrow: escrowAddr,
            platformState: platformPda(),
            vault: vaultPda(idBytes),
            creator: escrow.creator,
            counterparty,
            treasury: platform.treasury,
            signer: wallet,
            systemProgram: SystemProgram.programId,
          }
          switch (args.action) {
            case 'approveCompletion':
              return deps.program.methods.approveCompletionSol().accountsPartial(accounts).instruction()
            case 'claimStalledPayment':
              return deps.program.methods.claimStalledPaymentSol().accountsPartial(accounts).instruction()
            case 'reclaimAbandoned':
              return deps.program.methods.reclaimAbandonedSol().accountsPartial(accounts).instruction()
          }
        }
        const mint = escrow.asset
        const accounts = {
          escrow: escrowAddr,
          platformState: platformPda(),
          vaultTokenAccount: tokenVaultPda(idBytes),
          creator: escrow.creator,
          counterparty,
          treasury: platform.treasury,
          creatorTokenAccount: getAssociatedTokenAddressSync(mint, escrow.creator),
          counterpartyTokenAccount: getAssociatedTokenAddressSync(mint, counterparty),
          treasuryTokenAccount: getAssociatedTokenAddressSync(mint, platform.treasury),
          signer: wallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
        switch (args.action) {
          case 'approveCompletion':
            return deps.program.methods.approveCompletionSpl().accountsPartial(accounts).instruction()
          case 'claimStalledPayment':
            return deps.program.methods.claimStalledPaymentSpl().accountsPartial(accounts).instruction()
          case 'reclaimAbandoned':
            return deps.program.methods.reclaimAbandonedSpl().accountsPartial(accounts).instruction()
        }
        // Exhaustive switch above — unreachable, but satisfies control-flow analysis.
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, `unhandled settle action`)
      }

      case 'cancelEscrow':
      case 'refundExpired': {
        const { escrowAddr, idBytes, escrow } = await fetchEscrow(args.payload.escrow_id)
        if (isNativeSol(escrow)) {
          const accounts = {
            escrow: escrowAddr,
            vault: vaultPda(idBytes),
            creator: wallet,
            systemProgram: SystemProgram.programId,
          }
          return args.action === 'cancelEscrow'
            ? deps.program.methods.cancelEscrowSol().accountsPartial(accounts).instruction()
            : deps.program.methods.refundExpiredSol().accountsPartial(accounts).instruction()
        }
        const accounts = {
          escrow: escrowAddr,
          vaultTokenAccount: tokenVaultPda(idBytes),
          creatorTokenAccount: getAssociatedTokenAddressSync(escrow.asset, wallet),
          creator: wallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
        return args.action === 'cancelEscrow'
          ? deps.program.methods.cancelEscrowSpl().accountsPartial(accounts).instruction()
          : deps.program.methods.refundExpiredSpl().accountsPartial(accounts).instruction()
      }

      case 'disputeEscrow': {
        const { escrowAddr, idBytes, escrow } = await fetchEscrow(args.payload.escrow_id)
        const bond = toBn(args.payload.bond_raw, 'bond_raw')
        if (isNativeSol(escrow)) {
          return deps.program.methods
            .disputeEscrowSol(bond)
            .accountsPartial({
              escrow: escrowAddr,
              vault: vaultPda(idBytes),
              raiser: wallet,
              systemProgram: SystemProgram.programId,
            })
            .instruction()
        }
        return deps.program.methods
          .disputeEscrowSpl(bond)
          .accountsPartial({
            escrow: escrowAddr,
            vaultTokenAccount: tokenVaultPda(idBytes),
            raiserTokenAccount: getAssociatedTokenAddressSync(escrow.asset, wallet),
            raiser: wallet,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      }

      case 'resolveDispute': {
        const { escrowAddr, idBytes, escrow } = await fetchEscrow(args.payload.escrow_id)
        const platform = await fetchPlatformState()
        const counterparty = counterpartyOrThrow(escrow)
        const winner = WINNER_ARG[args.payload.winner]
        const raiser = new PublicKey(
          await deps.resolveWalletAddress(args.payload.raiser_user_id),
        )
        if (isNativeSol(escrow)) {
          return deps.program.methods
            .resolveDisputeSol(winner, raiser)
            .accountsPartial({
              escrow: escrowAddr,
              platformState: platformPda(),
              vault: vaultPda(idBytes),
              creator: escrow.creator,
              counterparty,
              treasury: platform.treasury,
              disputeAdmin: wallet,
              systemProgram: SystemProgram.programId,
            })
            .instruction()
        }
        const mint = escrow.asset
        return deps.program.methods
          .resolveDisputeSpl(winner, raiser)
          .accountsPartial({
            escrow: escrowAddr,
            platformState: platformPda(),
            vaultTokenAccount: tokenVaultPda(idBytes),
            creator: escrow.creator,
            counterparty,
            treasury: platform.treasury,
            creatorTokenAccount: getAssociatedTokenAddressSync(mint, escrow.creator),
            counterpartyTokenAccount: getAssociatedTokenAddressSync(mint, counterparty),
            treasuryTokenAccount: getAssociatedTokenAddressSync(mint, platform.treasury),
            disputeAdmin: wallet,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      }
    }
  }

  // ---- shared lookups -----------------------------------------------------

  async function fetchEscrow(escrow_id: string): Promise<{
    escrowAddr: PublicKey
    idBytes: Buffer
    escrow: EscrowAccount
  }> {
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

  async function fetchPlatformState(): Promise<PlatformStateAccount> {
    const addr = platformPda().toBase58()
    const data = await deps.rpc.getAccountData(addr)
    if (data === null) {
      throw new AppError(
        500,
        ErrorCode.INTERNAL_ERROR,
        `platform state account ${addr} not initialized`,
      )
    }
    return decodePlatformStateAccount(deps.program.coder, data)
  }

  return { buildTx }
}

// ---- pure helpers ---------------------------------------------------------

const WINNER_ARG = {
  creator: { creator: {} },
  counterparty: { counterparty: {} },
  split: { split: {} },
} as const

function isNativeSol(escrow: EscrowAccount): boolean {
  return escrow.asset.equals(SystemProgram.programId)
}

function counterpartyOrThrow(escrow: EscrowAccount): PublicKey {
  if (escrow.counterparty === null) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_WRONG_STATUS,
      'escrow has no counterparty on-chain; action requires an accepted escrow',
    )
  }
  return escrow.counterparty
}

function toBn(value: AmountRaw, field: string): BN {
  if (!isAmountRaw(value)) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, `${field} is not a canonical AmountRaw`)
  }
  return new BN(value)
}

/** Solana proof hashes travel base58 (types.ts SubmitProofPayload). */
function decodeProofHash(proof_hash: string): number[] {
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
