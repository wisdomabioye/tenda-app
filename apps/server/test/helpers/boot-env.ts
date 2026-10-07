/**
 * Deterministic chain configuration for boot/CLI integration suites.
 * Import FIRST. Each node:test file runs in its own process, so these values
 * live for that suite only. Never inherit deployment chains from a local .env.
 * No RPC is contacted: these suites exercise registry writes and app boot.
 */
import './test-app/env'
import { chainEnvPrefix, resetChainSecretsCache } from '@server/chains/secrets'
import { FAKE_EVM_ESCROW, FAKE_RELAYER_ADDRESS, TEST_CHAIN_ID_ALT } from './test-app'

for (const key of Object.keys(process.env)) {
  if (key.startsWith('CHAIN_')) delete process.env[key]
}
const prefix = chainEnvPrefix(TEST_CHAIN_ID_ALT)
process.env[`${prefix}_RPC_URL`] = 'http://127.0.0.1:59999'
process.env[`${prefix}_ESCROW_ADDR`] = FAKE_EVM_ESCROW
process.env[`${prefix}_TREASURY_ADDR`] = FAKE_RELAYER_ADDRESS
resetChainSecretsCache()
