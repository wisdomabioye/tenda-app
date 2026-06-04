/**
 * Solana GasSeedSender — transfers the one-time SOL seed from the hot
 * wallet (#40, SOLANA_GAS_SEED_WALLET_KEY) to a newly linked wallet.
 *
 * Kept as a leaf under chains/solana: lib/gas-seed.ts orchestrates via the
 * GasSeedSender interface and never touches web3.js.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import type { GasSeedSender } from '@server/lib/gas-seed'
import { commitmentFor } from '@server/chains/solana/rpc'
import type { ChainId } from '@server/chains/types'

export function solanaGasSeedSender(args: {
  rpc_url: string
  chain_id: ChainId
  /** base58-encoded 64-byte secret key of the seed hot wallet. */
  secret_key_base58: string
}): GasSeedSender {
  const commitment = commitmentFor(args.chain_id)
  const connection = new Connection(args.rpc_url, commitment)
  const keypair = Keypair.fromSecretKey(bs58.decode(args.secret_key_base58))

  return {
    async send({ to_address, amount_raw }) {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(to_address),
          lamports: BigInt(amount_raw),
        }),
      )
      const tx_ref = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment,
      })
      return { tx_ref }
    },
  }
}
