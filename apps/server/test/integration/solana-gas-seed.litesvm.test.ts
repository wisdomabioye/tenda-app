/**
 * The Solana gas seed's TRANSFER, against the real Solana runtime (#53b item 5).
 *
 * This is the gap #53a made visible rather than caused: its EVM twin reached
 * 100% while the whole body of Solana's `send` — the SystemProgram transfer
 * that actually pays a user — had no test at all, because it built a
 * `Connection` from an RPC URL and could only be exercised against a cluster.
 * The port seam (`SolanaGasSeedPort`, mirroring `EvmGasSeedPort`) is what makes
 * it reachable; LiteSVM runs the same runtime a validator does, so "the
 * lamports arrived" is measured rather than assumed.
 *
 * The task's own instruction was to do this BEFORE funding a hot wallet: an
 * untested transfer body is the last thing standing between a funded seed
 * wallet and a user.
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert'
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'
import { solanaGasSeedSenderFromPort } from '@server/features/gas-seed/senders/solana'
import type { GasSeedSender } from '@server/features/gas-seed'
import { litesvmGasSeedPort, litesvmSkip, startLiteSvm, type LiteSvmFixture } from '../helpers/litesvm'

const skip = litesvmSkip

/** The manifest's Solana seed today — lamports, not wei. */
const SEED_LAMPORTS = '7000000'

let fx: LiteSvmFixture
let funder: Keypair
let sender: GasSeedSender

before(async () => {
  if (skip) return
  fx = await startLiteSvm()
  funder = Keypair.generate()
  // A hot wallet with real lamports, which is the state a funded deployment is
  // in. Everything below asks what happens to them.
  fx.svm.airdrop(funder.publicKey, BigInt(LAMPORTS_PER_SOL))
  sender = solanaGasSeedSenderFromPort(litesvmGasSeedPort(fx.svm, funder))
})

after(() => {
  // LiteSVM is in-process; nothing to tear down, but the hook documents that
  // deliberately rather than leaving a reader wondering what was leaked.
})

test('the seed LANDS: a fresh wallet gains exactly the granted lamports', { skip }, async () => {
  const recipient = Keypair.generate().publicKey
  assert.strictEqual(fx.svm.getBalance(recipient) ?? 0n, 0n, 'a fresh account holds nothing')

  const { tx_ref } = await sender.send({
    to_address: recipient.toBase58(),
    amount_raw: SEED_LAMPORTS,
  })

  assert.strictEqual(fx.svm.getBalance(recipient), BigInt(SEED_LAMPORTS))
  // A real signature, not a fabricated string: `gas_grants.tx_ref` is what
  // verify-gas-seed later looks up on-chain, and a made-up ref would pass every
  // in-process assertion and fail only in production.
  assert.strictEqual(bs58.decode(tx_ref).length, 64)
})

test('the funder PAYS: the lamports come out of the hot wallet, plus fees', { skip }, async () => {
  const before_ = fx.svm.getBalance(funder.publicKey) ?? 0n
  const recipient = Keypair.generate().publicKey

  await sender.send({ to_address: recipient.toBase58(), amount_raw: SEED_LAMPORTS })

  const after_ = fx.svm.getBalance(funder.publicKey) ?? 0n
  const spent = before_ - after_
  // Strictly MORE than the grant: the hot wallet also pays the transaction fee,
  // which is the reason a balance floor cannot simply be `amount_raw` (#53b
  // item 4 sizes the floor with headroom for exactly this).
  assert.ok(spent > BigInt(SEED_LAMPORTS), `funder spent ${spent}, grant is ${SEED_LAMPORTS}`)
})

test('a seed ADDS to a wallet that already holds something', { skip }, async () => {
  // Not a supported flow — the grant's primary key allows one per user per
  // chain — but it pins that the transfer is additive rather than a set. A
  // sender that somehow replaced a balance would be catastrophic and silent.
  //
  // The two amounts DIFFER on purpose: LiteSVM keeps one live blockhash, so two
  // identical transfers from the same payer to the same account produce the
  // same signature and the second is rejected as already processed. That is a
  // property of the harness, not of the sender.
  const recipient = Keypair.generate().publicKey
  const second = '3000000'
  await sender.send({ to_address: recipient.toBase58(), amount_raw: SEED_LAMPORTS })
  await sender.send({ to_address: recipient.toBase58(), amount_raw: second })
  assert.strictEqual(fx.svm.getBalance(recipient), BigInt(SEED_LAMPORTS) + BigInt(second))
})

test('an UNFUNDED hot wallet fails instead of half-succeeding', { skip }, async () => {
  // The state every new deployment starts in. `dispatchGasSeeds` and the claim
  // job both release the claimed slot on this throw, so the user is seeded
  // later rather than recorded as seeded with nothing to show for it.
  const empty = Keypair.generate()
  const broke = solanaGasSeedSenderFromPort(litesvmGasSeedPort(fx.svm, empty))
  const recipient = Keypair.generate().publicKey

  await assert.rejects(() =>
    broke.send({ to_address: recipient.toBase58(), amount_raw: SEED_LAMPORTS }),
  )
  assert.strictEqual(fx.svm.getBalance(recipient) ?? 0n, 0n, 'nothing moved')
})

test('a malformed destination throws HERE, before any transfer is attempted', { skip }, async () => {
  // `new PublicKey(...)` is the sender's own guard. Letting a bad address reach
  // web3.js buries the failure several frames down, and the address comes from
  // `user_wallets` — data, not a literal.
  const before_ = fx.svm.getBalance(funder.publicKey) ?? 0n
  await assert.rejects(() => sender.send({ to_address: 'not-a-solana-address', amount_raw: SEED_LAMPORTS }))
  assert.strictEqual(fx.svm.getBalance(funder.publicKey), before_, 'the hot wallet was untouched')
})

test('a non-numeric amount throws before the transfer, not during it', { skip }, async () => {
  const before_ = fx.svm.getBalance(funder.publicKey) ?? 0n
  await assert.rejects(() =>
    sender.send({ to_address: Keypair.generate().publicKey.toBase58(), amount_raw: 'lots' }),
  )
  assert.strictEqual(fx.svm.getBalance(funder.publicKey), before_)
})
