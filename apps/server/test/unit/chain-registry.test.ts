import { test } from 'node:test'
import * as assert from 'node:assert'
import { buildChainRegistry } from '@server/chains'
import type { Config } from '@server/config'

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    DATABASE_URL: 'postgres://localhost/test',
    JWT_SECRET: 'secret',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    SOLANA_TREASURY_ADDRESS: 'Treasury1111111111111111111111111111111111',
    SOLANA_PROGRAM_ID: 'Tenda1111111111111111111111111111111111111',
    PLATFORM_FEE_BPS: 250,
    JWT_EXPIRES_IN: '7d',
    SOLANA_NETWORK: 'devnet',
    CORS_ORIGIN: null,
    ADMIN_ORIGIN: null,
    ...overrides,
  }
}

test('buildChainRegistry: devnet config registers solana:devnet', () => {
  const r = buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'devnet' }))
  assert.strictEqual(r.has('solana:devnet'), true)
  assert.strictEqual(r.has('solana:mainnet'), false)
  assert.strictEqual(r.get('solana:devnet').namespace, 'solana')
})

test('buildChainRegistry: mainnet-beta config registers solana:mainnet', () => {
  const r = buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'mainnet-beta' }))
  assert.strictEqual(r.has('solana:mainnet'), true)
  assert.strictEqual(r.has('solana:devnet'), false)
})

test('buildChainRegistry: get() throws on unregistered chain_id', () => {
  const r = buildChainRegistry(baseConfig())
  assert.throws(() => r.get('eip155:8453'), /no adapter registered/)
})

test('buildChainRegistry: list() returns all registered adapters', () => {
  const r = buildChainRegistry(baseConfig())
  const list = r.list()
  assert.strictEqual(list.length, 1)
  assert.strictEqual(list[0]?.namespace, 'solana')
})

test('buildChainRegistry: registered adapter has correct chain_id', () => {
  const r = buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'devnet' }))
  assert.strictEqual(r.get('solana:devnet').chain_id, 'solana:devnet')
})

test('buildChainRegistry: unsupported SOLANA_NETWORK throws at boot (no silent alias)', () => {
  assert.throws(
    () => buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'testnet' })),
    /unsupported SOLANA_NETWORK='testnet'/,
  )
})

test('buildChainRegistry: empty SOLANA_NETWORK throws', () => {
  assert.throws(
    () => buildChainRegistry(baseConfig({ SOLANA_NETWORK: '' })),
    /unsupported SOLANA_NETWORK/,
  )
})
