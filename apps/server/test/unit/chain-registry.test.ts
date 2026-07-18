/**
 * chains/index — generic adapter construction from active secrets + manifest,
 * and the registry wrapper. Deps are stubbed (never invoked at construction);
 * secrets are built through the real loader so the (secret → adapter) wiring is
 * exercised end-to-end.
 */
import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  buildAdapters,
  buildChainRegistry,
  resolveEvmRpcFallback,
  type AdapterDepsFactory,
} from '@server/chains'
import { loadChainSecrets } from '@server/chains/secrets'
import { chainById } from '@tenda/shared'

const SOL = 'So11111111111111111111111111111111111111112'
const EVM = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const RPC = 'https://rpc.example'

const STUB: AdapterDepsFactory = {
  solana: () => ({
    resolveWalletAddress: async () => 'wallet',
    resolveAsset: async () => ({ token_address: null }),
  }),
  evm: () => ({
    resolveWalletAddress: async () => 'wallet',
    resolveAsset: async () => ({ token_address: null }),
  }),
}

const solSecrets = () =>
  loadChainSecrets({ CHAIN_SOLANA_DEVNET_RPC_URL: RPC, CHAIN_SOLANA_DEVNET_TREASURY_ADDR: SOL })
const baseSecrets = () =>
  loadChainSecrets({
    CHAIN_EIP155_8453_RPC_URL: RPC,
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM,
  })
const celoSecrets = () =>
  loadChainSecrets({
    CHAIN_EIP155_42220_RPC_URL: RPC,
    CHAIN_EIP155_42220_ESCROW_ADDR: EVM,
    CHAIN_EIP155_42220_TREASURY_ADDR: EVM,
  })

test('buildAdapters: a solana secret yields one solana adapter', () => {
  const adapters = buildAdapters(solSecrets(), STUB)
  assert.strictEqual(adapters.length, 1)
  assert.strictEqual(adapters[0]?.chain_id, 'solana:devnet')
  assert.strictEqual(adapters[0]?.namespace, 'solana')
})

test('buildAdapters: an EVM secret yields one eip155 adapter', () => {
  const adapters = buildAdapters(baseSecrets(), STUB)
  assert.strictEqual(adapters[0]?.chain_id, 'eip155:8453')
  assert.strictEqual(adapters[0]?.namespace, 'eip155')
})

test('buildAdapters: a feeCurrency (CELO) secret builds its adapter with the manifest fee token', () => {
  // Exercises the feeCurrency branch + requireFeeCurrency (resolves cUSD's
  // manifest address); a missing address would throw at build.
  const adapters = buildAdapters(celoSecrets(), STUB)
  assert.strictEqual(adapters[0]?.chain_id, 'eip155:42220')
  assert.strictEqual(adapters[0]?.namespace, 'eip155')
})

test('buildAdapters: empty secrets yield no adapters', () => {
  assert.strictEqual(buildAdapters(loadChainSecrets({}), STUB).length, 0)
})

test('buildChainRegistry: has/get/list over built adapters', () => {
  const r = buildChainRegistry(buildAdapters(solSecrets(), STUB))
  assert.strictEqual(r.has('solana:devnet'), true)
  assert.strictEqual(r.has('eip155:8453'), false)
  assert.strictEqual(r.get('solana:devnet').chain_id, 'solana:devnet')
  assert.strictEqual(r.list().length, 1)
})

test('buildChainRegistry: get() throws on an unregistered chain id', () => {
  const r = buildChainRegistry(buildAdapters(solSecrets(), STUB))
  assert.throws(() => r.get('eip155:8453'), /no adapter registered/)
})

test('buildChainRegistry: a duplicate chain id throws at build', () => {
  const adapters = buildAdapters(solSecrets(), STUB)
  assert.throws(() => buildChainRegistry([...adapters, ...adapters]), /duplicate chain registration/)
})

// ---------- resolveEvmRpcFallback (failover endpoint selection) --------------

test('rpc fallback: defaults to the manifest publicRpcUrl when no override', () => {
  const secret = baseSecrets().get('eip155:8453')
  assert.ok(secret && secret.namespace === 'eip155')
  assert.strictEqual(
    resolveEvmRpcFallback(secret, chainById('eip155:8453')),
    'https://mainnet.base.org',
  )
})

test('rpc fallback: the RPC_URL_FALLBACK secret overrides the default', () => {
  const secrets = loadChainSecrets({
    CHAIN_EIP155_8453_RPC_URL: RPC,
    CHAIN_EIP155_8453_RPC_URL_FALLBACK: 'https://keyed-fallback.example/v2/key',
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM,
  })
  const secret = secrets.get('eip155:8453')
  assert.ok(secret && secret.namespace === 'eip155')
  assert.strictEqual(
    resolveEvmRpcFallback(secret, chainById('eip155:8453')),
    'https://keyed-fallback.example/v2/key',
  )
})

test('rpc fallback: dropped when it would duplicate the primary', () => {
  // Primary IS the public endpoint → failing over to itself is pointless.
  const secrets = loadChainSecrets({
    CHAIN_EIP155_8453_RPC_URL: 'https://mainnet.base.org',
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM,
  })
  const secret = secrets.get('eip155:8453')
  assert.ok(secret && secret.namespace === 'eip155')
  assert.strictEqual(resolveEvmRpcFallback(secret, chainById('eip155:8453')), undefined)
})

test('rpc fallback: an explicit override equal to the primary is also dropped', () => {
  const secrets = loadChainSecrets({
    CHAIN_EIP155_8453_RPC_URL: RPC,
    CHAIN_EIP155_8453_RPC_URL_FALLBACK: RPC,
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM,
  })
  const secret = secrets.get('eip155:8453')
  assert.ok(secret && secret.namespace === 'eip155')
  assert.strictEqual(resolveEvmRpcFallback(secret, chainById('eip155:8453')), undefined)
})
