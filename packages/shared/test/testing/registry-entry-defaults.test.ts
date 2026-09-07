import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ChainRegistryEntry } from '../../src/api/contracts/platform.contract'
import { chainPublicFacts } from '../../src/chains/manifest-queries'
import { registryEntryDefaults } from '../../src/testing'

test('a known chain id gets the manifest\'s real public facts and no relay', () => {
  assert.deepEqual(registryEntryDefaults('eip155:84532'), {
    relayed_funding_available: false,
    rpc_url: 'https://sepolia.base.org',
    explorer_url: 'https://sepolia.basescan.org',
    faucet_url: 'https://faucet.circle.com',
  })
  assert.deepEqual(registryEntryDefaults('eip155:84532'), { relayed_funding_available: false, ...chainPublicFacts('eip155:84532') })
})

test('a fabricated chain id gets nulls — the same answer the route gives an unknown chain', () => {
  assert.deepEqual(registryEntryDefaults('eip155:999999'), {
    relayed_funding_available: false,
    rpc_url: null,
    explorer_url: null,
    faucet_url: null,
  })
})

test('identity fields plus the defaults plus assets is a complete entry — the seam the fixtures rely on', () => {
  // Compile-time is the assertion: if ChainRegistryEntry gains a required
  // field the helper does not supply, this literal stops type-checking, which
  // is the one-edit signal #140 exists for. The runtime check is that an
  // override AFTER the spread wins, so a fixture can still ask for a relay.
  const entry: ChainRegistryEntry = {
    id: 'eip155:84532',
    namespace: 'eip155',
    display_name: 'Base Sepolia',
    escrow_address: '0xEscrow',
    ...registryEntryDefaults('eip155:84532'),
    relayed_funding_available: true,
    assets: [],
  }
  assert.equal(entry.relayed_funding_available, true)
  assert.equal(entry.faucet_url, 'https://faucet.circle.com')
})
