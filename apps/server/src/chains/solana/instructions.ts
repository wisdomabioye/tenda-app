/**
 * Per-action instruction encoding for the Solana escrow program. One switch
 * over `BuildTxArgs.action`; asset forking (SOL vs SPL variants) is derived
 * from decoded on-chain state. No network I/O outside the injected RPC (via the
 * shared lookups); the Anchor `Program` is used purely for encoding.
 */

import { BN } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, type TransactionInstruction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { uuidToBytes } from '@server/chains/ids'
import { escrowPda, platformPda, tokenVaultPda, vaultPda } from '@server/chains/solana/pdas'
import type { BuildTxArgs } from '@server/chains/types'
import {
  ataProvisioningIx,
  counterpartyOrThrow,
  decodeProofHash,
  fetchEscrow,
  fetchPlatformState,
  isNativeSol,
  toBn,
  WINNER_ARG,
  type SolanaBuilderDeps,
} from '@server/chains/solana/builder-internals'

/**
 * Encode the instruction(s) for one escrow action. Returns an array because
 * SPL settlement/dispute-resolution paths prepend idempotent ATA-provisioning
 * instructions (see `ataProvisioningIx`); every other path returns a single
 * instruction. The action's own instruction is always last.
 */
export async function buildInstruction(
  deps: SolanaBuilderDeps,
  args: BuildTxArgs,
  wallet: PublicKey,
): Promise<TransactionInstruction[]> {
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
          p.assigned_counterparty_user_id !== undefined
            ? new PublicKey(await deps.resolveWalletAddress(p.assigned_counterparty_user_id))
            : null,
        acceptDeadline: new BN(p.accept_deadline_unix),
        completionDurationSeconds: new BN(p.completion_duration_seconds),
        disputeBond: toBn(p.dispute_bond_raw, 'dispute_bond_raw'),
        isSeeker: p.is_seeker,
      }
      if (asset.token_address === null) {
        return [
          await deps.program.methods
            .createEscrowSol(ixArgs)
            .accountsPartial({
              escrow: escrowPda(idBytes),
              vault: vaultPda(idBytes),
              creator: wallet,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ]
      }
      const mint = new PublicKey(asset.token_address)
      return [
        await deps.program.methods
          .createEscrowSpl(ixArgs)
          .accountsPartial({
            escrow: escrowPda(idBytes),
            vaultTokenAccount: tokenVaultPda(idBytes),
            mint,
            creatorTokenAccount: getAssociatedTokenAddressSync(mint, wallet),
            creator: wallet,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ]
    }

    case 'acceptEscrow':
    case 'declineAssignedEscrow': {
      const { escrowAddr } = await fetchEscrow(deps, args.payload.escrow_id)
      const method =
        args.action === 'acceptEscrow'
          ? deps.program.methods.acceptEscrow()
          : deps.program.methods.declineAssignedEscrow()
      return [
        await method
          .accountsPartial({ escrow: escrowAddr, platformState: platformPda(), signer: wallet })
          .instruction(),
      ]
    }

    case 'submitProof': {
      const { escrowAddr } = await fetchEscrow(deps, args.payload.escrow_id)
      return [
        await deps.program.methods
          .submitProof(decodeProofHash(args.payload.proof_hash))
          .accountsPartial({ escrow: escrowAddr, platformState: platformPda(), signer: wallet })
          .instruction(),
      ]
    }

    case 'approveCompletion':
    case 'claimStalledPayment':
    case 'reclaimAbandoned': {
      const { escrowAddr, idBytes, escrow } = await fetchEscrow(deps, args.payload.escrow_id)
      const platform = await fetchPlatformState(deps)
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
            return [await deps.program.methods.approveCompletionSol().accountsPartial(accounts).instruction()]
          case 'claimStalledPayment':
            return [await deps.program.methods.claimStalledPaymentSol().accountsPartial(accounts).instruction()]
          case 'reclaimAbandoned':
            return [await deps.program.methods.reclaimAbandonedSol().accountsPartial(accounts).instruction()]
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
      // `SettleSpl` deserializes creator/counterparty/treasury token accounts
      // regardless of which the handler pays, so provision all three.
      const preIx = ataProvisioningIx(wallet, [escrow.creator, counterparty, platform.treasury], mint)
      switch (args.action) {
        case 'approveCompletion':
          return [...preIx, await deps.program.methods.approveCompletionSpl().accountsPartial(accounts).instruction()]
        case 'claimStalledPayment':
          return [...preIx, await deps.program.methods.claimStalledPaymentSpl().accountsPartial(accounts).instruction()]
        case 'reclaimAbandoned':
          return [...preIx, await deps.program.methods.reclaimAbandonedSpl().accountsPartial(accounts).instruction()]
      }
      // Exhaustive switch above — unreachable, but satisfies control-flow analysis.
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, `unhandled settle action`)
    }

    case 'cancelEscrow':
    case 'refundExpired': {
      const { escrowAddr, idBytes, escrow } = await fetchEscrow(deps, args.payload.escrow_id)
      if (isNativeSol(escrow)) {
        const accounts = {
          escrow: escrowAddr,
          vault: vaultPda(idBytes),
          creator: wallet,
          systemProgram: SystemProgram.programId,
        }
        return [
          args.action === 'cancelEscrow'
            ? await deps.program.methods.cancelEscrowSol().accountsPartial(accounts).instruction()
            : await deps.program.methods.refundExpiredSol().accountsPartial(accounts).instruction(),
        ]
      }
      const accounts = {
        escrow: escrowAddr,
        vaultTokenAccount: tokenVaultPda(idBytes),
        creatorTokenAccount: getAssociatedTokenAddressSync(escrow.asset, wallet),
        creator: wallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
      return [
        args.action === 'cancelEscrow'
          ? await deps.program.methods.cancelEscrowSpl().accountsPartial(accounts).instruction()
          : await deps.program.methods.refundExpiredSpl().accountsPartial(accounts).instruction(),
      ]
    }

    case 'disputeEscrow': {
      const { escrowAddr, idBytes, escrow } = await fetchEscrow(deps, args.payload.escrow_id)
      const bond = toBn(args.payload.bond_raw, 'bond_raw')
      if (isNativeSol(escrow)) {
        return [
          await deps.program.methods
            .disputeEscrowSol(bond)
            .accountsPartial({
              escrow: escrowAddr,
              vault: vaultPda(idBytes),
              raiser: wallet,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ]
      }
      return [
        await deps.program.methods
          .disputeEscrowSpl(bond)
          .accountsPartial({
            escrow: escrowAddr,
            vaultTokenAccount: tokenVaultPda(idBytes),
            raiserTokenAccount: getAssociatedTokenAddressSync(escrow.asset, wallet),
            raiser: wallet,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ]
    }

    case 'resolveDispute': {
      const { escrowAddr, idBytes, escrow } = await fetchEscrow(deps, args.payload.escrow_id)
      const platform = await fetchPlatformState(deps)
      const counterparty = counterpartyOrThrow(escrow)
      const winner = WINNER_ARG[args.payload.winner]
      const raiser = new PublicKey(await deps.resolveWalletAddress(args.payload.raiser_user_id))
      if (isNativeSol(escrow)) {
        return [
          await deps.program.methods
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
            .instruction(),
        ]
      }
      const mint = escrow.asset
      // `ResolveSpl` deserializes all three token accounts for every winner
      // outcome (a Split pays treasury nothing yet still loads its ATA), so
      // provision creator/counterparty/treasury unconditionally.
      const preIx = ataProvisioningIx(wallet, [escrow.creator, counterparty, platform.treasury], mint)
      return [
        ...preIx,
        await deps.program.methods
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
          .instruction(),
      ]
    }
  }
}
