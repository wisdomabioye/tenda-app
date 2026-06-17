import { test } from 'node:test'
import * as assert from 'node:assert'
import { buildChainRegistry, type ChainRegistryDeps } from '@server/chains'
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
    API_BASE_URL: 'https://api.tenda.test',
    PLATFORM_FEE_BPS: 250,
    JWT_EXPIRES_IN: '7d',
    SOLANA_NETWORK: 'devnet',
    SOLANA_USDC_MINT: null,
    TERMII_API_KEY: null,
    TERMII_SENDER_ID: null,
    SOLANA_GAS_SEED_WALLET_KEY: null,
    HELIUS_WEBHOOK_SECRET: null,
    LISTENER_PROVIDER: 'helius' as const,
    OPENROUTER_API_KEY: null,
    FCM_SERVICE_ACCOUNT_B64: null,
    APNS_KEY_ID: null,
    APNS_TEAM_ID: null,
    APNS_PRIVATE_KEY_B64: null,
    APNS_TOPIC: null,
    CORS_ORIGIN: null,
    ADMIN_ORIGIN: null,
    BASE_RPC_URL: null,
    BASE_ESCROW_ADDR: null,
    BASE_USDC_ADDR: null,
    CELO_RPC_URL: null,
    CELO_ESCROW_ADDR: null,
    MULTISIG_BASE_ADDR: null,
    MULTISIG_CELO_ADDR: null,
    COINBASE_PAYMASTER_URL: null,
    ALCHEMY_WEBHOOK_SECRET: null,
    FIAT_RAILS_ENABLED: false,
    YELLOWCARD_API_KEY: null,
    YELLOWCARD_API_SECRET: null,
    YELLOWCARD_WEBHOOK_SECRET: null,
    ONRAMPMONEY_API_KEY: null,
    ONRAMPMONEY_API_SECRET: null,
    ONRAMPMONEY_WEBHOOK_SECRET: null,
    NIP_API_KEY: null,
    REDIS_URL: null,
    RESEND_API_KEY: null,
    EMAIL_FROM: null,
    ADMIN_JWT_EXPIRES_IN: '12h',
    GOOGLE_OAUTH_CLIENT_IDS: null,
    APPLE_OAUTH_CLIENT_IDS: null,
    ...overrides,
  }
}


const TEST_DEPS: ChainRegistryDeps = {
  solana: {
    async resolveWalletAddress() {
      throw new Error('not used in registry tests')
    },
    async resolveAsset() {
      throw new Error('not used in registry tests')
    },
  },
}

test('buildChainRegistry: devnet config registers solana:devnet', () => {
  const r = buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'devnet' }), TEST_DEPS)
  assert.strictEqual(r.has('solana:devnet'), true)
  assert.strictEqual(r.has('solana:mainnet'), false)
  assert.strictEqual(r.get('solana:devnet').namespace, 'solana')
})

test('buildChainRegistry: mainnet-beta config registers solana:mainnet', () => {
  const r = buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'mainnet-beta' }), TEST_DEPS)
  assert.strictEqual(r.has('solana:mainnet'), true)
  assert.strictEqual(r.has('solana:devnet'), false)
})

test('buildChainRegistry: get() throws on unregistered chain_id', () => {
  const r = buildChainRegistry(baseConfig(), TEST_DEPS)
  assert.throws(() => r.get('eip155:8453'), /no adapter registered/)
})

test('buildChainRegistry: list() returns all registered adapters', () => {
  const r = buildChainRegistry(baseConfig(), TEST_DEPS)
  const list = r.list()
  assert.strictEqual(list.length, 1)
  assert.strictEqual(list[0]?.namespace, 'solana')
})

test('buildChainRegistry: registered adapter has correct chain_id', () => {
  const r = buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'devnet' }), TEST_DEPS)
  assert.strictEqual(r.get('solana:devnet').chain_id, 'solana:devnet')
})

test('buildChainRegistry: unsupported SOLANA_NETWORK throws at boot (no silent alias)', () => {
  assert.throws(
    () => buildChainRegistry(baseConfig({ SOLANA_NETWORK: 'testnet' }), TEST_DEPS),
    /unsupported SOLANA_NETWORK='testnet'/,
  )
})

test('buildChainRegistry: empty SOLANA_NETWORK throws', () => {
  assert.throws(
    () => buildChainRegistry(baseConfig({ SOLANA_NETWORK: '' }), TEST_DEPS),
    /unsupported SOLANA_NETWORK/,
  )
})
