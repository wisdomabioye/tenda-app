import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CHAIN_MANIFEST } from '@tenda/shared/chains'
import { LANDING_CHAINS } from '@/content'
import { explorerHost, transportFor } from '@/content/chains'
import { SupportedNetworks } from '../SupportedNetworks'
import { NETWORKS_HEADER } from '../content'

/**
 * The section's whole promise is that it lists the chains the MANIFEST ships,
 * with no hand-kept list to fall behind it. A test over the content module
 * alone cannot prove that — the grid could map a stale constant and every
 * derivation test would stay green. So this renders the real section and
 * reads the chain facts back out of the markup.
 */
const html = renderToStaticMarkup(<SupportedNetworks />)

describe('supported networks section', () => {
  it('renders a card for every mainnet chain in the manifest', () => {
    expect(LANDING_CHAINS.length).toBeGreaterThan(0)
    for (const chain of LANDING_CHAINS) {
      expect(html).toContain(chain.name)
    }
  })

  it('prints each chain’s CAIP-2 id, the identifier the API uses', () => {
    for (const chain of LANDING_CHAINS) {
      expect(html).toContain(chain.id)
    }
  })

  it('names the gas token and wallet transport for every chain', () => {
    for (const chain of LANDING_CHAINS) {
      expect(html).toContain(chain.nativeSymbol)
      const transport = transportFor(chain.namespace)
      expect(transport).not.toBe('')
      expect(html).toContain(transport)
    }
  })

  it('links each explorer by host, to the manifest’s own URL', () => {
    for (const chain of LANDING_CHAINS) {
      if (chain.explorerUrl === undefined) continue
      expect(html).toContain(chain.explorerUrl)
      expect(html).toContain(explorerHost(chain.explorerUrl))
    }
  })

  /**
   * External links opened with `target="_blank"` and no `rel` hand the opened
   * page a `window.opener` reference back to this one.
   */
  it('opens explorer links without leaking an opener reference', () => {
    expect(html).not.toMatch(/target="_blank"(?![^>]*rel=)/)
    expect(html).toContain('noopener')
  })

  it('renders its own header copy', () => {
    expect(html).toContain(NETWORKS_HEADER.eyebrow)
    expect(html).toContain(NETWORKS_HEADER.h2.emphasis)
  })

  /**
   * The section deliberately does not offer to add a network to the visitor's
   * wallet — see the note in content.ts. `wallet_addEthereumChain` is EVM-only
   * and could never serve Solana, and the affordance belongs in apps/web at
   * connect time. Pinned so it cannot be added here without a deliberate edit
   * to this test.
   */
  it('makes no offer to configure the visitor’s wallet', () => {
    expect(html).not.toContain('wallet_addEthereumChain')
    expect(html.toLowerCase()).not.toContain('add to metamask')
    expect(html.toLowerCase()).not.toContain('add network')
  })

  /**
   * Base's manifest gas policy is 'paymaster' and that rail is NOT live. A
   * table that printed the policy name would imply sponsored gas the product
   * does not currently provide.
   */
  it('never implies gas is sponsored', () => {
    const lower = html.toLowerCase()
    expect(lower).not.toContain('paymaster')
    expect(lower).not.toContain('gasless')
    expect(lower).not.toContain('free gas')
  })

  /**
   * Testnets are development infrastructure and are never marketed.
   *
   * Asserted against the manifest's ACTUAL testnet entries rather than against
   * the substring 'testnet'. The first draft did the latter and failed on this
   * section's own footnote, which says testnets are not listed — a check that
   * cannot tell a chain row from prose about chain rows is measuring the wrong
   * thing, and would have been "fixed" by rewording honest copy.
   */
  it('lists none of the manifest’s testnet chains', () => {
    const testnets = CHAIN_MANIFEST.filter((entry) => entry.kind === 'testnet')
    expect(testnets.length).toBeGreaterThan(0)
    for (const entry of testnets) {
      expect(html).not.toContain(entry.id)
      expect(html).not.toContain(entry.displayName)
    }
  })
})
