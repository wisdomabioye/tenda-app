/**
 * Solana GasSeedSender, transfers the one-time SOL seed from the hot
 * wallet (`CHAIN_<ID>_GAS_SEED_KEY`) to a newly linked wallet.
 *
 * A leaf beside its EVM twin: ../dispatch orchestrates via the GasSeedSender
 * interface and never touches web3.js, so the seed can be removed without the
 * chain adapters noticing.
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
import type { GasSeedSender } from '../dispatch'
import type { GasSeedFunder } from './index'
import { commitmentFor } from '@server/chains/solana/rpc'
import type { ChainId } from '@server/chains/types'

/**
 * The base58 public key of a base58-encoded 64-byte secret key. Used by the
 * seeder to record `chains.gas_seed_wallet_address` (audit-only) from the SAME
 * secret the sender signs with, so the recorded funder can never drift from the
 * wallet that actually pays. Throws on a malformed key (fail-fast at seed time).
 */
export function gasSeedAddressFromSecret(secret_key_base58: string): string {
  return Keypair.fromSecretKey(bs58.decode(secret_key_base58)).publicKey.toBase58()
}

/**
 * The paying wallet on Solana — see `evmGasSeedFunder` for why this is a port
 * of its own rather than a method on the sender.
 *
 * `getBalance` answers in lamports, which is already the base unit the grant's
 * `amount_raw` is denominated in, so no scaling happens here (and must not:
 * scaling in one namespace and not the other is exactly how a seed of the
 * wrong magnitude gets sent).
 */
export function solanaGasSeedFunder(args: {
  rpc_url: string
  chain_id: ChainId
  secret_key_base58: string
}): GasSeedFunder {
  const connection = new Connection(args.rpc_url, commitmentFor(args.chain_id))
  const keypair = Keypair.fromSecretKey(bs58.decode(args.secret_key_base58))
  return {
    address: keypair.publicKey.toBase58(),
    balance: async () => BigInt(await connection.getBalance(keypair.publicKey)),
  }
}

/**
 * The one chain operation the Solana seed needs, as a port — the same seam
 * `evmGasSeedSenderFromPort` uses, and for the same reason.
 *
 * Without it the whole body of `send` was unreachable from a test: it builds a
 * `Connection` from an RPC URL and calls `sendAndConfirmTransaction`, so
 * proving that it moves lamports needed a live cluster. Its EVM twin sat at
 * 100% while this sat at 66% of its functions — the transfer that actually
 * pays a user was the untested part.
 *
 * Behind the port sits web3.js on a real cluster; in the suite sits LiteSVM
 * running the same runtime, so "the lamports arrived" is proved rather than
 * assumed.
 */
export interface SolanaGasSeedPort {
  /** Move `lamports` from the hot wallet to `to`, confirmed. Returns the signature. */
  transfer(args: { to: PublicKey; lamports: bigint }): Promise<string>
}

/**
 * The sender's DECISIONS, over any port: parse the destination, convert the
 * amount, hand back the signature as the tx_ref.
 *
 * `new PublicKey(to_address)` is the guard worth naming — a malformed address
 * throws HERE, named, rather than inside web3.js several frames down, and the
 * caller (`dispatchGasSeeds`, or the claim job) releases the slot on that throw
 * so the user is not marked seeded for a transfer that never happened.
 */
export function solanaGasSeedSenderFromPort(port: SolanaGasSeedPort): GasSeedSender {
  return {
    async send({ to_address, amount_raw }) {
      const tx_ref = await port.transfer({
        to: new PublicKey(to_address),
        lamports: BigInt(amount_raw),
      })
      return { tx_ref }
    },
  }
}

export function solanaGasSeedSender(args: {
  rpc_url: string
  chain_id: ChainId
  /** base58-encoded 64-byte secret key of the seed hot wallet. */
  secret_key_base58: string
}): GasSeedSender {
  const commitment = commitmentFor(args.chain_id)
  const connection = new Connection(args.rpc_url, commitment)
  const keypair = Keypair.fromSecretKey(bs58.decode(args.secret_key_base58))

  return solanaGasSeedSenderFromPort({
    async transfer({ to, lamports }) {
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: to, lamports }),
      )
      // `sendAndConfirmTransaction` CONFIRMS, unlike viem's `sendTransaction` —
      // which is why the EVM twin has to wait for a receipt explicitly and this
      // does not. Both return only once the transfer is on-chain.
      return sendAndConfirmTransaction(connection, tx, [keypair], { commitment })
    },
  })
}
