import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CHAIN_MANIFEST } from '@tenda/shared/chains'
import {
  CHAIN_STATUS_DISPLAY,
  LANDING_CHAINS,
  LIVE_CHAINS,
  PLANNED_CHAINS,
  chainStatus,
  displayFor,
  explorerHost,
  transportFor,
  type LandingChain,
} from '@/content'
import { NetworkCard } from '../NetworkCard'
import { Networks } from '../Networks'
import { NETWORKS_HEADER, NETWORK_LABELS } from '../content'

/**
 * The section's whole promise is that it lists the chains the MANIFEST ships,
 * with no hand-kept list to fall behind it. A test over the content module
 * alone cannot prove that — the grid could map a stale constant and every
 * derivation test would stay green. So this renders the real section and
 * reads the chain facts back out of the markup.
 */
// The surface is handed down by the page (#55); this suite is about the
// section's content, so either value renders the same table.
const html = renderToStaticMarkup(<Networks surface="base" />)

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

  /**
   * `truncate` is `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`
   * — a TEXT affordance. An overflowing flex child is not ellipsised, it is
   * cut, so an interactive control inside a truncating box can be silently
   * clipped into being unclickable with nothing on screen to say so. The copy
   * button used to live inside one.
   *
   * Asserted on structure rather than on pixels because the browser needed to
   * measure the exact width was unavailable in this environment — but the
   * structure is wrong regardless of the width at which it first bites.
   */
  it('never puts the copy button inside a truncating container', () => {
    const cells = [...html.matchAll(/<dd class="([^"]*)"[^>]*>([\s\S]*?)<\/dd>/g)]
    expect(cells.length).toBeGreaterThan(0)
    for (const [, className, inner] of cells) {
      if (!inner.includes('<button')) continue
      expect(className).not.toContain('truncate')
    }
  })

  it('still truncates the chain id itself, which is what can overflow', () => {
    expect(html).toMatch(/<span class="truncate">eip155:/)
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
  /**
   * The section's central claim, and the one it got wrong.
   *
   * Every card carries a copyable CAIP-2 id and an explorer link — reference
   * data a visitor may act on. It shipped with four such cards and no contract
   * behind any of them, because the grid derived from `kind === 'mainnet'` and
   * nothing on the page distinguished a chain Tenda runs on from a chain Tenda
   * merely intends to. These assert the badge tracks the MANIFEST, in both
   * directions, so neither a missing badge nor an over-generous one can return.
   */
  it('labels every card with the status the manifest declares', () => {
    for (const chain of LANDING_CHAINS) {
      const expected = CHAIN_STATUS_DISPLAY[chainStatus(chain)].label
      // The card is the smallest thing that can carry a per-chain claim; the
      // section-level markup would let one chain's badge stand in for another.
      const card = renderToStaticMarkup(<NetworkCard chain={chain} />)
      expect(card).toContain(chain.name)
      expect(card).toContain(expected)
    }
  })

  it('calls no chain Live unless the manifest says it is deployed', () => {
    const liveLabel = CHAIN_STATUS_DISPLAY.live.label
    for (const chain of PLANNED_CHAINS) {
      const card = renderToStaticMarkup(<NetworkCard chain={chain} />)
      expect(card).not.toContain(liveLabel)
      expect(card).toContain(CHAIN_STATUS_DISPLAY.planned.label)
    }
  })

  it('does call a deployed chain Live — the badge is not stuck on Planned', () => {
    // The other direction. Without it the whole feature could be a constant
    // "Planned" and every assertion above would still pass. Skipped while no
    // mainnet has shipped, and it starts asserting the day one does.
    if (LIVE_CHAINS.length === 0) return
    for (const chain of LIVE_CHAINS) {
      expect(renderToStaticMarkup(<NetworkCard chain={chain} />)).toContain(
        CHAIN_STATUS_DISPLAY.live.label,
      )
    }
  })

  it('lists none of the manifest’s testnet chains', () => {
    const testnets = CHAIN_MANIFEST.filter((entry) => entry.kind === 'testnet')
    expect(testnets.length).toBeGreaterThan(0)
    for (const entry of testnets) {
      expect(html).not.toContain(entry.id)
      expect(html).not.toContain(entry.displayName)
    }
  })
})

/**
 * The manifest-first path: a chain reaches CHAIN_MANIFEST before anyone adds
 * its marketing row, and `displayFor` hands back `var(--brand)` for the colour.
 * No shipped chain takes this path, which is exactly why it broke unnoticed —
 * the card tinted its glyph badge with `${chain.color}1a`, producing the
 * invalid declaration `var(--brand)1a`.
 */
describe('a chain with no marketing row yet', () => {
  const unknown: LandingChain = {
    id: 'eip155:10',
    family: 'not-a-family',
    namespace: 'eip155',
    gasPolicy: 'none',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io',
    ...displayFor('not-a-family', 'Optimism'),
  }
  const card = renderToStaticMarkup(<NetworkCard chain={unknown} />)

  it('uses the manifest display name and the fallback colour token', () => {
    expect(unknown.color).toBe('var(--brand)')
    expect(card).toContain('Optimism')
  })

  /**
   * The regression itself. A CSS variable with hex digits welded onto the end
   * is not a colour; the browser drops the whole declaration and the tint
   * silently disappears.
   */
  it('never welds hex digits onto a CSS variable', () => {
    expect(card).not.toContain('var(--brand)1a')
    expect(card).not.toMatch(/var\(--[a-z-]+\)[0-9a-f]{2}/)
  })

  it('tints with a function that accepts a variable', () => {
    expect(card).toContain('color-mix')
  })

  /**
   * A new EVM L2 still gets its transport from the NAMESPACE, so the Wallet
   * row is present even with no marketing row — that is the whole point of
   * keying transport on namespace rather than on family.
   */
  it('still names a transport, because that comes from the namespace', () => {
    expect(card).toContain(NETWORK_LABELS.transport)
    expect(card).toContain('WalletConnect')
  })

  /** The pitch it does not have is omitted, not rendered as an empty line. */
  it('omits the pitch it has no value for', () => {
    expect(unknown.pitch).toBe('')
    expect(card).toContain(NETWORK_LABELS.gasToken)
  })
})

/**
 * The other absent-value path: a namespace the product has no wallet adapter
 * for. The row is dropped rather than printing a label above a blank.
 */
describe('a chain on a namespace with no adapter', () => {
  const foreign: LandingChain = {
    id: 'cosmos:cosmoshub-4',
    family: 'not-a-family',
    namespace: 'cosmos',
    gasPolicy: 'none',
    nativeSymbol: 'ATOM',
    ...displayFor('not-a-family', 'Cosmos Hub'),
  }
  const card = renderToStaticMarkup(<NetworkCard chain={foreign} />)

  it('omits the wallet row entirely', () => {
    expect(transportFor(foreign.namespace)).toBe('')
    expect(card).not.toContain(NETWORK_LABELS.transport)
  })

  /** No explorerUrl on this one either — the link row goes too. */
  it('omits the explorer row when the manifest has no URL', () => {
    expect(foreign.explorerUrl).toBeUndefined()
    expect(card).not.toContain(NETWORK_LABELS.explorer)
    expect(card).not.toContain('<a ')
  })

  it('still renders the facts it does have', () => {
    expect(card).toContain('Cosmos Hub')
    expect(card).toContain('ATOM')
    expect(card).toContain('cosmos:cosmoshub-4')
  })
})
