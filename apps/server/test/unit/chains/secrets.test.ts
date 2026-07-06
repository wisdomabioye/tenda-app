import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  loadChainSecrets,
  chainEnvPrefix,
  solanaSecret,
  paymasterChainSecret,
  disputeAdminFor,
  getChainSecrets,
  resetChainSecretsCache,
} from '@server/chains/secrets'

// Verified, well-formed sample values per namespace (real-shape, not the live
// deployment's secrets). base58 = a 44-char Solana pubkey; evmAddr = 0x+40hex.
const SOL_PUBKEY = '7H6AAoghUCPAVA1WTEwpSmkiRfPHWrgFidZQPzbXzkes'
const EVM_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const RPC = 'https://api.devnet.solana.com'
const EVM_RPC = 'https://base-sepolia.example/v2/key'

/** Minimal env that activates exactly Solana devnet. */
function solanaDevnetEnv(): NodeJS.ProcessEnv {
  return {
    CHAIN_SOLANA_DEVNET_RPC_URL: RPC,
    CHAIN_SOLANA_DEVNET_TREASURY_ADDR: SOL_PUBKEY,
  }
}

/** Minimal env that activates exactly Base mainnet. */
function baseMainnetEnv(): NodeJS.ProcessEnv {
  return {
    CHAIN_EIP155_8453_RPC_URL: EVM_RPC,
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM_ADDR,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM_ADDR,
  }
}

// ---------- env-prefix sanitisation -----------------------------------------

test('chainEnvPrefix sanitises CAIP-2 ids into env-safe prefixes', () => {
  assert.equal(chainEnvPrefix('eip155:8453'), 'CHAIN_EIP155_8453')
  assert.equal(chainEnvPrefix('solana:mainnet'), 'CHAIN_SOLANA_MAINNET')
  assert.equal(chainEnvPrefix('eip155:84532'), 'CHAIN_EIP155_84532')
})

// ---------- positive paths ---------------------------------------------------

test('empty env activates no chains (all inactive)', () => {
  const secrets = loadChainSecrets({})
  assert.equal(secrets.size, 0)
})

test('a fully-configured Solana chain resolves with the solana shape', () => {
  const secrets = loadChainSecrets(solanaDevnetEnv())
  assert.equal(secrets.size, 1)
  const sol = secrets.get('solana:devnet')
  assert.ok(sol && sol.namespace === 'solana')
  assert.equal(sol.rpcUrl, RPC)
  assert.equal(sol.treasury, SOL_PUBKEY)
  assert.equal(sol.usdcMint, undefined)
  assert.equal(sol.gasSeedKey, undefined)
})

test('a fully-configured EVM chain resolves with the eip155 shape', () => {
  const secrets = loadChainSecrets(baseMainnetEnv())
  const base = secrets.get('eip155:8453')
  assert.ok(base && base.namespace === 'eip155')
  assert.equal(base.rpcUrl, EVM_RPC)
  assert.equal(base.escrow, EVM_ADDR)
  assert.equal(base.treasury, EVM_ADDR)
  assert.equal(base.paymasterUrl, undefined)
})

test('optional fields are captured when present', () => {
  const env = {
    ...solanaDevnetEnv(),
    CHAIN_SOLANA_DEVNET_USDC_MINT: SOL_PUBKEY,
    CHAIN_SOLANA_DEVNET_GAS_SEED_KEY: 'someBase58SecretKeyValue',
    CHAIN_SOLANA_DEVNET_WEBHOOK_SECRET: 'whsec_abc',
  }
  const sol = loadChainSecrets(env).get('solana:devnet')
  assert.ok(sol && sol.namespace === 'solana')
  assert.equal(sol.usdcMint, SOL_PUBKEY)
  assert.equal(sol.gasSeedKey, 'someBase58SecretKeyValue')
  assert.equal(sol.webhookSecret, 'whsec_abc')
})

test('two different-family chains can both be active', () => {
  const secrets = loadChainSecrets({ ...solanaDevnetEnv(), ...baseMainnetEnv() })
  assert.equal(secrets.size, 2)
  assert.ok(secrets.has('solana:devnet'))
  assert.ok(secrets.has('eip155:8453'))
})

// ---------- inactive vs absent edge cases -----------------------------------

test('empty-string and whitespace-only values are treated as absent', () => {
  const secrets = loadChainSecrets({
    CHAIN_SOLANA_DEVNET_RPC_URL: '',
    CHAIN_SOLANA_DEVNET_PROGRAM_ID: '   ',
  })
  assert.equal(secrets.size, 0, 'blank values must not activate or error the chain')
})

// ---------- negative paths (boot errors) -------------------------------------

test('partial required config throws and names the missing key', () => {
  assert.throws(
    () => loadChainSecrets({ CHAIN_SOLANA_DEVNET_RPC_URL: RPC }),
    /partially configured.*CHAIN_SOLANA_DEVNET_TREASURY_ADDR/s,
  )
})

test('a present optional with required missing is still a partial-config error', () => {
  assert.throws(
    () => loadChainSecrets({ CHAIN_SOLANA_DEVNET_WEBHOOK_SECRET: 'whsec' }),
    /partially configured/,
  )
})

test('a malformed EVM address throws and names the key', () => {
  assert.throws(
    () => loadChainSecrets({ ...baseMainnetEnv(), CHAIN_EIP155_8453_ESCROW_ADDR: '0xnothex' }),
    /malformed.*CHAIN_EIP155_8453_ESCROW_ADDR/s,
  )
})

test('a malformed RPC url throws', () => {
  assert.throws(
    () => loadChainSecrets({ ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_RPC_URL: 'not a url' }),
    /malformed.*RPC_URL/s,
  )
})

test('a malformed base58 treasury address throws', () => {
  assert.throws(
    () => loadChainSecrets({ ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_TREASURY_ADDR: '0OIl-invalid' }),
    /malformed.*TREASURY_ADDR/s,
  )
})

test('an unrecognised CHAIN_ env var (typo) is a boot error', () => {
  assert.throws(
    () => loadChainSecrets({ ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_RPHC_URL: RPC }),
    /unrecognised chain env var.*CHAIN_SOLANA_DEVNET_RPHC_URL/s,
  )
})

test('unrecognised-key detection ignores blank typo vars', () => {
  // A blank typo shouldn't trip the guard — only non-empty unknown keys do.
  const secrets = loadChainSecrets({ ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_RPHC_URL: '' })
  assert.equal(secrets.size, 1)
})

test('two same-family chains both configured throws one-per-family', () => {
  const env = {
    CHAIN_EIP155_8453_RPC_URL: EVM_RPC,
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM_ADDR,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM_ADDR,
    CHAIN_EIP155_84532_RPC_URL: EVM_RPC,
    CHAIN_EIP155_84532_ESCROW_ADDR: EVM_ADDR,
    CHAIN_EIP155_84532_TREASURY_ADDR: EVM_ADDR,
  }
  assert.throws(() => loadChainSecrets(env), /share family 'base'/)
})

// ---------- typed accessors -------------------------------------------------

test('solanaSecret returns the active Solana chain or undefined', () => {
  const solActive = loadChainSecrets(solanaDevnetEnv())
  const sol = solanaSecret(solActive)
  assert.ok(sol && sol.namespace === 'solana' && sol.chainId === 'solana:devnet')
  // Only an EVM chain active → no Solana.
  assert.equal(solanaSecret(loadChainSecrets(baseMainnetEnv())), undefined)
})

test('paymasterChainSecret returns the active paymaster EVM chain or undefined', () => {
  const base = paymasterChainSecret(loadChainSecrets(baseMainnetEnv()))
  assert.ok(base && base.namespace === 'eip155' && base.chainId === 'eip155:8453')
  // Solana-only deployment → no paymaster chain.
  assert.equal(paymasterChainSecret(loadChainSecrets(solanaDevnetEnv())), undefined)
})

test('getChainSecrets caches and resetChainSecretsCache clears it', () => {
  // getChainSecrets reads the real process.env; assert it is stable (cached)
  // and that reset returns a fresh map instance.
  const first = getChainSecrets()
  assert.equal(getChainSecrets(), first, 'same instance while cached')
  resetChainSecretsCache()
  assert.notEqual(getChainSecrets(), first, 'new instance after reset')
})

test('all errors are aggregated into one throw', () => {
  // Partial Solana + malformed Base + unknown key → a single error listing all.
  const env = {
    CHAIN_SOLANA_DEVNET_RPC_URL: RPC, // partial (missing program id + treasury)
    CHAIN_EIP155_8453_RPC_URL: EVM_RPC,
    CHAIN_EIP155_8453_ESCROW_ADDR: 'bad',
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM_ADDR,
    CHAIN_BOGUS_KEY: 'x',
  }
  try {
    loadChainSecrets(env)
    assert.fail('expected a throw')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    assert.match(msg, /partially configured/)
    assert.match(msg, /malformed/)
    assert.match(msg, /unrecognised chain env var/)
  }
})

// ---------- dispute_admin authority (Issue-3 C2 pre-flight) -----------------

test('dispute_admin authority: Solana reads a base58 value, per chain', () => {
  const env = { ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_DISPUTE_ADMIN_ADDR: SOL_PUBKEY }
  const secrets = loadChainSecrets(env)
  assert.equal(secrets.get('solana:devnet')?.disputeAdmin, SOL_PUBKEY)
  assert.equal(disputeAdminFor('solana:devnet', secrets), SOL_PUBKEY)
})

test('dispute_admin authority: EVM reads a 0x value, distinct from Solana', () => {
  const env = { ...baseMainnetEnv(), CHAIN_EIP155_8453_DISPUTE_ADMIN_ADDR: EVM_ADDR }
  const secrets = loadChainSecrets(env)
  assert.equal(secrets.get('eip155:8453')?.disputeAdmin, EVM_ADDR)
  assert.equal(disputeAdminFor('eip155:8453', secrets), EVM_ADDR)
})

test('dispute_admin authority: optional — absent leaves it undefined, no error', () => {
  const secrets = loadChainSecrets(solanaDevnetEnv())
  assert.equal(secrets.get('solana:devnet')?.disputeAdmin, undefined)
  assert.equal(disputeAdminFor('solana:devnet', secrets), undefined)
  assert.equal(disputeAdminFor('eip155:8453', secrets), undefined) // unconfigured chain
})

test('dispute_admin authority: a malformed value is a boot error naming the key', () => {
  // An EVM address in the Solana slot fails base58 validation.
  const env = { ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_DISPUTE_ADMIN_ADDR: EVM_ADDR }
  assert.throws(() => loadChainSecrets(env), /malformed value\(s\) for CHAIN_SOLANA_DEVNET_DISPUTE_ADMIN_ADDR/)
})
