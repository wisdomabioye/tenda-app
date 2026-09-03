/**
 * Solana GasSeedSender, transfers the one-time SOL seed from the hot
 * wallet (`CHAIN_<ID>_GAS_SEED_KEY`) to a newly linked wallet.
 *
 * A leaf beside its EVM twin: ../dispatch orchestrates via the GasSeedSender
 * interface and never touches web3.js, so the seed can be removed without the
 * chain adapters noticing.
 */

import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionError,
} from '@solana/web3.js'
import bs58 from 'bs58'
import type { GasSeedSender } from '../dispatch'
import type { GasSeedFunder } from './index'
import {
  commitmentFor,
  perEndpointTimeoutMs,
  solanaConnections,
  withRpcFallback,
} from '@server/chains/rpc'
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
  /**
   * Secondary endpoint, ideally a different provider. Present and DISTINCT
   * makes the balance read fail over.
   *
   * Worth having because of what "unreadable" COSTS here: `seedStanding`
   * turns a failed read into SeedBalanceUnreadableError, and the low-balance
   * monitor treats unreadable as "no alert" — so one blip on the primary both
   * hides the balance AND suppresses the notice that would have told anyone.
   * Observed on a live tick before this existed.
   *
   * A required key, matching every other builder that reaches a chain from a
   * secret (`web3SolanaRelayer`, `viemEvmRelayer`, both EVM gas-seed entry
   * points). The audit that added those found the SAME omission five times, each
   * one a value that stopped a hop short; leaving this one optional would leave
   * the last place it can happen again.
   */
  rpc_url_fallback: string | undefined
  chain_id: ChainId
  secret_key_base58: string
  /**
   * Per-attempt budget override. Same knob `createSolanaRpc` and
   * `web3SolanaRelayer` expose, for the same reason — the derived default is
   * six seconds, which a suite proving the hung-endpoint path should not have
   * to sit through. Production never passes it: `GasSeedChainArgs` carries no
   * timeout, so the derived value is what every real caller gets.
   */
  timeout_ms?: number
}): GasSeedFunder {
  const keypair = Keypair.fromSecretKey(bs58.decode(args.secret_key_base58))
  // Clients and failover BOTH from the central seam. The first version of this
  // hand-rolled its own try/catch, which is precisely the drift this file is
  // not allowed to repeat — see chains/rpc.
  const connections = solanaConnections(args)
  // The per-attempt budget is the ONLY bound on this read — nothing upstream
  // imposes one, and the caller is a 15-minute monitor tick that walks chains
  // in sequence, so one hung endpoint would stall every later chain in the tick
  // as well as this one.
  const timeout_ms = perEndpointTimeoutMs(args)
  return {
    address: keypair.publicKey.toBase58(),
    balance: () =>
      withRpcFallback(connections, async (c) => BigInt(await c.getBalance(keypair.publicKey)), {
        timeout_ms,
      }),
  }
}

/**
 * The one chain operation the Solana seed needs, as a port — the same seam
 * `evmGasSeedSenderFromPort` uses, and for the same reason.
 *
 * Without it the whole body of `send` was unreachable from a test: it builds a
 * `Connection` from an RPC URL and broadcasts through it, so proving that it
 * moves lamports needed a live cluster. Its EVM twin sat at 100% while this sat
 * at 66% of its functions — the transfer that actually pays a user was the
 * untested part.
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

/**
 * A confirmation that failed, resolved against the CHAIN rather than believed.
 *
 * THE BUG THIS EXISTS FOR, measured on devnet: `sendAndConfirmTransaction`
 * confirms over a WebSocket signature subscription. Where that subscription
 * cannot be established — a provider whose HTTP key does not authorise WS
 * answers 401 — confirmation degrades to blockhash-expiry polling and throws
 * "block height exceeded" roughly 20 seconds AFTER the transfer has landed.
 * `dispatchGasSeeds` then reads that throw as "the transfer did not happen",
 * releases the claimed slot, and the user is PAID AND STILL CLAIMABLE — one
 * grant per attempt, out of the hot wallet.
 *
 * So a failed confirmation is a question, not an answer. Ask the chain.
 *
 * INCONCLUSIVE COUNTS AS SUCCESS, and that is the deliberate half. When the
 * status check itself fails we do not know whether the money moved, and the two
 * mistakes are not equal: a false SUCCESS strands a grant row that
 * `verify:gas-seed` already reports as "claimed but never finalized" — visible,
 * repairable, paid once — while a false FAILURE frees the slot and pays a second
 * time. ../dispatch makes the same trade one step later, for the same reason.
 */
/**
 * Does a signature status mean the seed was DELIVERED?
 *
 * Extracted, and not inlined in the closure below, because it is the one place
 * three distinct chain answers collapse into a yes/no about money:
 *   null            — the cluster has never seen it. Not delivered.
 *   { err: null }   — landed and succeeded. Delivered.
 *   { err: <any> }  — landed and FAILED. On chain, but the lamports never moved,
 *                     so treating it as delivered would stamp a grant for a
 *                     transfer that did not happen.
 *
 * Inline it was unreachable from a test: the only caller is inside the web3
 * body that needs a live cluster, so the third case — the one that would
 * silently pay nobody — had no coverage at all.
 *
 * `confirmationStatus` IS DELIBERATELY IGNORED, and this is the paragraph that
 * stops someone adding it back. web3's `SignatureStatus` also carries
 * `'processed' | 'confirmed' | 'finalized'`, and requiring at least the chain's
 * commitment looks like the more rigorous check. It is the wrong direction
 * here: a transaction sitting at `'processed'` would then read as NOT landed,
 * this returns false, `settleSignature` rethrows, ../dispatch releases the slot
 * — and the user who was in fact paid can claim again. Every other trade in
 * this path is made the same way round: a grant stamped for a transaction that
 * later drops leaves a row `verify:gas-seed` reports, and nobody is paid twice.
 */
export function signatureDelivered(value: { err: TransactionError | null } | null): boolean {
  return value !== null && value.err === null
}

export async function settleSignature(args: {
  signature: string
  /** Wait for confirmation; may reject on WS failure or blockhash expiry. */
  confirm: () => Promise<unknown>
  /** Did it land? Consulted ONLY after `confirm` rejects. */
  landed: (signature: string) => Promise<boolean>
}): Promise<string> {
  try {
    await args.confirm()
    return args.signature
  } catch (confirmError) {
    let landed: boolean
    try {
      landed = await args.landed(args.signature)
    } catch {
      // Cannot tell. Keep the claim: see the header for why this direction.
      return args.signature
    }
    if (landed) return args.signature
    throw confirmError
  }
}

/**
 * STILL ONE ENDPOINT — but no longer because failover would be unsafe.
 *
 * It used to be: `sendAndConfirmTransaction` signed INSIDE the call against a
 * blockhash it fetched itself, so a second endpoint meant re-signing against a
 * fresh blockhash — a different signature, a second distinct transfer, and a
 * user paid twice if the first had landed.
 *
 * That blocker is GONE. `transfer` below now signs ONCE against a known
 * blockhash and broadcasts the raw bytes, so sending those same bytes to a
 * second endpoint is the same transaction with the same signature and the
 * cluster de-duplicates it — exactly the property that makes EVM's nonce-pinned
 * re-broadcast safe. Adding the fallback here is now a parameter rather than a
 * rework, and it is tracked separately (see the task queue) rather than
 * smuggled into a change that was about not losing money.
 */
export function solanaGasSeedSender(args: {
  rpc_url: string
  chain_id: ChainId
  /** base58-encoded 64-byte secret key of the seed hot wallet. */
  secret_key_base58: string
}): GasSeedSender {
  const commitment = commitmentFor(args.chain_id)
  // `[0]` — the PRIMARY only, deliberately, and taken from the seam so the
  // choice is visible rather than achieved by not asking. See the header.
  const [connection] = solanaConnections({ chain_id: args.chain_id, rpc_url: args.rpc_url })
  const keypair = Keypair.fromSecretKey(bs58.decode(args.secret_key_base58))

  return solanaGasSeedSenderFromPort({
    async transfer({ to, lamports }) {
      // Signed and broadcast EXPLICITLY rather than through
      // `sendAndConfirmTransaction`, because that helper couples send and
      // confirm: when its confirmation fails the signature is buried in an error
      // message, and a transfer that landed cannot be told from one that did
      // not. Splitting them keeps the signature in hand for `settleSignature`.
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment)
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: to, lamports }),
      )
      tx.recentBlockhash = blockhash
      tx.feePayer = keypair.publicKey
      tx.sign(keypair)

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        preflightCommitment: commitment,
      })
      return settleSignature({
        signature,
        confirm: () =>
          connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, commitment),
        landed: async (sig) => {
          // `searchTransactionHistory`: the signature may have left the recent
          // status cache during the confirmation timeout, which is exactly the
          // window this check covers.
          const { value } = await connection.getSignatureStatus(sig, {
            searchTransactionHistory: true,
          })
          return signatureDelivered(value)
        },
      })
    },
  })
}
