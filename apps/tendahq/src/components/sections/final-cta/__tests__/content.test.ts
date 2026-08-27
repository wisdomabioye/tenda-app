import { describe, expect, it } from 'vitest'
import { LANDING_CHAINS } from '@/content/chains'
import { FEE_PCT } from '@/content/fees'
import { PLATFORM_CONFIG_DEFAULTS } from '@tenda/shared/constants/platform'
import { RECEIPTS } from '../content'

/**
 * The receipts strip is the last thing a visitor reads before downloading —
 * three mono "facts". Two of them shipped false (2026-08-27): 'Chains: 3 live'
 * beside a derived subline listing four, and 'Worker keeps 100% · No platform
 * cut on payouts' on a product whose flat fee is real, on-chain and quoted on
 * its own fees section. These pins keep each receipt tied to the source the
 * claim is actually about.
 */
describe('final CTA receipts', () => {
  const byKey = (k: string) => RECEIPTS.find((r) => r.k === k)

  it('counts live chains from the landing registry, never by hand', () => {
    const chains = byKey('Chains')
    expect(chains?.v).toBe(String(LANDING_CHAINS.length))
    for (const chain of LANDING_CHAINS) expect(chains?.b).toContain(chain.name)
  })

  it('quotes the worker share from the platform fee, and claims no fee-free lie', () => {
    const keeps = byKey('Worker keeps')
    expect(keeps?.v).toBe(String((10_000 - PLATFORM_CONFIG_DEFAULTS.fee_bps) / 100))
    expect(keeps?.b).toContain(`${FEE_PCT}%`)
    for (const receipt of RECEIPTS) {
      expect(receipt.b.toLowerCase()).not.toContain('no platform cut')
    }
  })
})
