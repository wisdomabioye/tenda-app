/**
 * The gas-seed hot wallet's RPC failover — the half that was missing.
 *
 * `rpcUrlFallback` reaches every chain secret and was consumed only by the
 * adapters and the listeners; the seed's funder and sender built one client on
 * the primary and stopped there. That cost more than a retry: `seedStanding`
 * turns a failed balance read into SeedBalanceUnreadableError, and the
 * low-balance monitor treats unreadable as NO ALERT — so a single blip both
 * hid the balance and suppressed the notice. Seen on a live tick.
 *
 * Failure is induced at the JSON-RPC layer rather than by killing a socket, so
 * the primary's attempt is RECORDED. That is what makes the negative cases
 * meaningful: "no failover" is proved by the primary being called exactly once,
 * which a dead port could not show.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { solanaGasSeedFunder } from '@server/features/gas-seed/senders/solana'
import { evmGasSeedFunder } from '@server/features/gas-seed/senders/evm'
import { GAS_SEED_SUPPORT } from '@server/features/gas-seed/senders'
import { web3SolanaRelayer } from '@server/chains/solana/relay/relayer'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { startStubRpc, type StubRpc } from '../helpers/stub-rpc'
import { within } from '../helpers/settle'

// GENERATED, not written down: only WHICH endpoint answers is under test, the
// address is derived locally from the secret, and a hand-typed base58 string is
// how this file first failed with 'provided secretKey is invalid'. Same
// convention as helpers/solana.ts.
const SOL_KEY = bs58.encode(Keypair.generate().secretKey)
/**
 * A syntactically valid recent blockhash: 32 zero bytes in base58.
 *
 * It has to parse, because the sender signs against it and serialises the
 * result — a placeholder string would throw inside web3.js and the test would
 * pass for the wrong reason.
 */
const BLOCKHASH = bs58.encode(Buffer.alloc(32))
const EVM_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const

/** A node that is UP and failing, plus one that answers. See stub-rpc's header. */
async function balanceStubs(good: unknown, method: string): Promise<[StubRpc, StubRpc]> {
  const primary = await startStubRpc((m) => {
    if (m === method) throw new Error('primary is down')
    return null
  })
  const secondary = await startStubRpc((m) => (m === method ? good : null))
  return [primary, secondary]
}

/** One failing node, for the cases where there is nothing to fail over to. */
function failing(method: string) {
  return (m: string): unknown => {
    if (m === method) throw new Error('primary is down')
    return null
  }
}

// ---------- Solana ---------------------------------------------------------

test('solana funder: a distinct fallback answers when the primary fails', async () => {
  const [primary, secondary] = await balanceStubs({ context: { slot: 1 }, value: 4242 }, 'getBalance')
  try {
    const funder = solanaGasSeedFunder({
      rpc_url: primary.url,
      rpc_url_fallback: secondary.url,
      chain_id: 'solana:devnet',
      secret_key_base58: SOL_KEY,
    })
    assert.strictEqual(await funder.balance(), 4242n)
    assert.strictEqual(primary.callsTo('getBalance').length, 1, 'the primary must be tried first')
    assert.strictEqual(secondary.callsTo('getBalance').length, 1, 'the fallback must answer')
  } finally {
    await primary.close()
    await secondary.close()
  }
})

test('solana funder: with NO fallback the failure propagates, tried once', async () => {
  const primary = await startStubRpc(failing('getBalance'))
  try {
    const funder = solanaGasSeedFunder({
      rpc_url: primary.url,
      // The control: explicitly none. Required as a key, so a caller with no
      // fallback says so rather than omitting it.
      rpc_url_fallback: undefined,
      chain_id: 'solana:devnet',
      secret_key_base58: SOL_KEY,
    })
    await assert.rejects(() => funder.balance())
    assert.strictEqual(primary.callsTo('getBalance').length, 1, 'exactly one attempt, no retry')
  } finally {
    await primary.close()
  }
})

test('solana funder: a fallback DUPLICATING the primary is not a second attempt', async () => {
  // The rule `distinctFallbackUrl` exists for, at the level that matters — a
  // deployment that copies its primary into the fallback var (0G Galileo's did)
  // must get single-endpoint behaviour, not two hits on the endpoint that just
  // failed.
  const primary = await startStubRpc(failing('getBalance'))
  try {
    const funder = solanaGasSeedFunder({
      rpc_url: primary.url,
      rpc_url_fallback: primary.url,
      chain_id: 'solana:devnet',
      secret_key_base58: SOL_KEY,
    })
    await assert.rejects(() => funder.balance())
    assert.strictEqual(primary.callsTo('getBalance').length, 1, 'must not hit the same endpoint twice')
  } finally {
    await primary.close()
  }
})

// ---------- EVM ------------------------------------------------------------

test('evm funder: a distinct fallback answers when the primary fails', async () => {
  const [primary, secondary] = await balanceStubs('0x10a4', 'eth_getBalance')
  try {
    const funder = evmGasSeedFunder({
      rpc_url: primary.url,
      rpc_url_fallback: secondary.url,
      chain_id: 'eip155:16602',
      private_key: EVM_KEY,
    })
    assert.strictEqual(await funder.balance(), 4260n)
    assert.ok(primary.callsTo('eth_getBalance').length >= 1, 'the primary must be tried first')
    assert.strictEqual(secondary.callsTo('eth_getBalance').length, 1, 'the fallback must answer')
  } finally {
    await primary.close()
    await secondary.close()
  }
})

test('evm funder: a fallback DUPLICATING the primary buys no second endpoint', async () => {
  const primary = await startStubRpc(failing('eth_getBalance'))
  try {
    const funder = evmGasSeedFunder({
      rpc_url: primary.url,
      rpc_url_fallback: primary.url,
      chain_id: 'eip155:16602',
      private_key: EVM_KEY,
    })
    await assert.rejects(() => funder.balance())
    // Single-endpoint transport: viem's own retry is what may repeat the call,
    // never a second URL. Asserted as "only this stub was ever contacted",
    // which is the claim that matters for a duplicated fallback var.
    assert.ok(primary.callsTo('eth_getBalance').length >= 1)
  } finally {
    await primary.close()
  }
})

// ---------- the deliberate asymmetry ---------------------------------------

test('the Solana SENDER never fails over, even when a fallback is configured', async () => {
  // Not an oversight, and this pins it as a decision. It PREDATES #58 and still
  // holds for a different reason: the sender now signs once and broadcasts those
  // exact bytes, so a second endpoint would carry the same signature and the
  // cluster would de-duplicate it — safe, but still not wired, and wiring it is
  // tracked separately rather than smuggled in here.
  //
  // THE BROADCAST IS WHAT THIS MUST EXERCISE. An earlier version failed the
  // primary outright, so `sign` threw and `send` was never reached — leaving
  // "the fallback was never contacted" trivially true and saying nothing about
  // the broadcast, which is the call that would cost money. So the primary
  // answers the blockhash fetch and fails only `sendTransaction`.
  //
  // Asserted through GAS_SEED_SUPPORT (the seam that HAS the fallback in hand
  // and chooses not to pass it), so someone threading it in has to delete this.
  const blockhash = { context: { slot: 1 }, value: { blockhash: BLOCKHASH, lastValidBlockHeight: 100 } }
  const primary = await startStubRpc((method) => {
    if (method === 'sendTransaction') throw new Error('primary refused the broadcast')
    return blockhash
  })
  const secondary = await startStubRpc(() => blockhash)
  try {
    const sender = GAS_SEED_SUPPORT.solana.buildSender({
      chain_id: 'solana:devnet',
      rpc_url: primary.url,
      rpc_url_fallback: secondary.url,
      key: SOL_KEY,
    })
    const signed = await sender.sign({
      to_address: Keypair.generate().publicKey.toBase58(),
      amount_raw: '1000',
    })
    await assert.rejects(() => signed.broadcast(), 'the primary refused, so the broadcast must fail')

    assert.ok(primary.callsTo('sendTransaction').length >= 1, 'the primary was asked to broadcast')
    assert.strictEqual(
      secondary.callsTo('sendTransaction').length,
      0,
      'the fallback must NEVER be asked to broadcast — that is a second transfer',
    )
    assert.strictEqual(secondary.calls.length, 0, 'the fallback was not contacted at all')
  } finally {
    await primary.close()
    await secondary.close()
  }
})

test('the Solana FUNDER built by the same seam DOES fail over', async () => {
  // The control for the test above: same seam, same args, opposite answer —
  // so "nothing failed over" cannot pass by the fallback simply being dropped
  // on the floor before it reaches either builder.
  const [primary, secondary] = await balanceStubs({ context: { slot: 1 }, value: 777 }, 'getBalance')
  try {
    const funder = GAS_SEED_SUPPORT.solana.buildFunder({
      chain_id: 'solana:devnet',
      rpc_url: primary.url,
      rpc_url_fallback: secondary.url,
      key: SOL_KEY,
    })
    assert.strictEqual(await funder.balance(), 777n)
    assert.strictEqual(secondary.callsTo('getBalance').length, 1)
  } finally {
    await primary.close()
    await secondary.close()
  }
})

// ---------- the relayer, whose failover was dead code -----------------------

test('the Solana relayer reads through its configured fallback', async () => {
  // This is the test that would have caught it. `web3SolanaRelayer` did not
  // ACCEPT an `rpc_url_fallback`, and plugins/chains.ts did not pass one, so
  // `solanaConnections` inside it always returned exactly one client — the
  // failover wrapping was real and had nothing to fail over to. Nothing failed;
  // the relayer simply had no redundancy on a chain configured for it.
  //
  // Driven end to end through the real factory rather than by inspecting its
  // internals, so the assertion is "a read survives a dead primary", which is
  // the property an operator cares about.
  const [primary, secondary] = await balanceStubs({ context: { slot: 1 }, value: 31337 }, 'getBalance')
  try {
    const relayer = web3SolanaRelayer({
      rpc_url: primary.url,
      rpc_url_fallback: secondary.url,
      chain_id: 'solana:devnet',
      secret_key_base58: SOL_KEY,
    })
    assert.strictEqual(await relayer.getBalance(relayer.public_key), 31337n)
    assert.strictEqual(secondary.callsTo('getBalance').length, 1, 'the fallback answered')
  } finally {
    await primary.close()
    await secondary.close()
  }
})

test('the relayer with no fallback still reads, and fails on its own', async () => {
  // The control: most deployments configure none, and this path must keep the
  // single-endpoint behaviour it always had rather than acquiring a second
  // client from nowhere.
  const primary = await startStubRpc((m) =>
    m === 'getBalance' ? { context: { slot: 1 }, value: 5 } : null,
  )
  try {
    const relayer = web3SolanaRelayer({
      rpc_url: primary.url,
      // The control: explicitly NO second endpoint. Required as a key, so this
      // reads as a decision rather than an omission.
      rpc_url_fallback: undefined,
      chain_id: 'solana:devnet',
      secret_key_base58: SOL_KEY,
    })
    assert.strictEqual(await relayer.getBalance(relayer.public_key), 5n)
    assert.strictEqual(primary.callsTo('getBalance').length, 1)
  } finally {
    await primary.close()
  }
})

// ---------- the funder's per-attempt budget --------------------------------

test('solana funder: a HUNG primary is abandoned and the fallback answers', async () => {
  // The failure mode that does not reject: the node accepts the request and
  // never responds. `withRpcFallback` only advances on rejection, so without a
  // per-attempt timeout the funder waits forever and the fallback it was given
  // is never reached — failover on paper only.
  //
  // Why this matters HERE more than anywhere else: nothing upstream bounds this
  // read. The caller is the 15-minute monitor tick, which walks chains in
  // sequence, so one hung endpoint stalls every later chain in the same tick.
  //
  // MEASURED: removing `timeout_ms` at this call site left the whole suite
  // green, which is how the repair reached the combinator and never reached the
  // caller.
  const hung = await startStubRpc(() => new Promise(() => {}))
  const good = await startStubRpc((m) =>
    m === 'getBalance' ? { context: { slot: 1 }, value: 909 } : null,
  )
  try {
    const funder = solanaGasSeedFunder({
      rpc_url: hung.url,
      rpc_url_fallback: good.url,
      chain_id: 'solana:devnet',
      secret_key_base58: SOL_KEY,
      // Short on purpose: the derived default is 6s and this suite has no
      // reason to sit through it. The BEHAVIOUR under test is "the hung
      // endpoint is abandoned at all", which any budget demonstrates.
      timeout_ms: 150,
    })
    const balance = await within(funder.balance(), 5_000, 'the hung primary was never abandoned')
    assert.strictEqual(balance, 909n)
    assert.strictEqual(good.callsTo('getBalance').length, 1, 'the fallback answered')
  } finally {
    await hung.close()
    await good.close()
  }
})
