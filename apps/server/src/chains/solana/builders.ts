/**
 * Unsigned-transaction orchestrator for every escrow action: resolve the
 * signer wallet, encode the action's instruction(s) (instructions.ts), SPL
 * settlement/resolve paths prepend idempotent ATA-provisioning instructions,
 * wrap them in a v0 `VersionedTransaction` against a fresh blockhash, and
 * serialize. Asset forking + on-chain lookups live in instructions.ts /
 * builder-internals.ts; the only network I/O here is the injected `SolanaRpc`.
 */

import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import type { BuildTxArgs, UnsignedTx } from '@server/chains/types'
import { buildInstruction } from '@server/chains/solana/instructions'
import type { SolanaBuilderDeps } from '@server/chains/solana/builder-internals'

export type { SolanaBuilderDeps }

export function createSolanaBuilders(deps: SolanaBuilderDeps) {
  async function buildTx(args: BuildTxArgs): Promise<UnsignedTx> {
    const wallet = new PublicKey(await deps.resolveWalletAddress(args.user_id))
    const instructions = await buildInstruction(deps, args, wallet)
    const { blockhash, last_valid_block_height } = await deps.rpc.getLatestBlockhash()
    const message = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message()
    const tx = new VersionedTransaction(message)
    return {
      kind: 'solana-tx',
      tx_base64: Buffer.from(tx.serialize()).toString('base64'),
      recent_blockhash: blockhash,
      last_valid_block_height,
    }
  }

  return { buildTx }
}
