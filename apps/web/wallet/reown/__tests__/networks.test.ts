/**
 * Manifest ↔ Reown network bridge. The mapping table is duplicated in
 * apps/admin/providers/reown/networks.ts by design (each Next app owns its
 * wallet wiring); THIS test is the anti-drift tripwire — a manifest chain
 * missing from the map fails the module import itself.
 */
import { describe, expect, it } from 'vitest'
import { CHAIN_MANIFEST, chainNamespaceOf } from '@tenda/shared'
import { appKitNetworks, evmNetworks, appKitNetworkForChain } from '@/wallet/reown/networks'

describe('manifest coverage', () => {
  it('maps EVERY manifest chain to an AppKit network (fail-loud contract)', () => {
    // The module already threw at import time if a mapping were missing;
    // assert per-chain anyway so the failure names the chain.
    for (const chain of CHAIN_MANIFEST) {
      expect(appKitNetworkForChain(chain.id), chain.id).toBeDefined()
    }
    expect(appKitNetworks).toHaveLength(CHAIN_MANIFEST.length)
  })

  it('evmNetworks is exactly the eip155 subset of the manifest', () => {
    const evmCount = CHAIN_MANIFEST.filter((c) => chainNamespaceOf(c.id) === 'eip155').length
    expect(evmNetworks).toHaveLength(evmCount)
  })

  it('throws (never silently drops) for a chain the manifest does not carry', () => {
    expect(() => appKitNetworkForChain('eip155:999999')).toThrow(/no AppKitNetwork mapped/)
  })
})
