/**
 * Ecosystems section — one panel per supported chain, written for two readers
 * at once: users deciding whether Tenda is real, and ecosystem teams deciding
 * whether Tenda is worth backing.
 *
 * EVERY proof point must be a shipped, verifiable integration, or carry
 * `roadmap` and say plainly that it is not here yet. No "in progress" for work
 * that has not started — the Base sponsorship rail was labelled in-progress
 * while its build path was known-invalid, which is the failure mode this rule
 * exists to prevent.
 *
 * Panel identity (name, glyph, colour) comes from content/chains.ts.
 */

export interface EcosystemPanel {
  /** Manifest family — joins to LANDING_CHAINS for name/glyph/colour. */
  chainFamily: 'solana' | 'base' | 'celo'
  /** Why Tenda builds here — one sentence. */
  why: string
  /** Shipped integration proof points, most impressive first. */
  proofs: readonly { label: string; roadmap?: true }[]
}

export const ECOSYSTEM_PANELS: readonly EcosystemPanel[] = [
  {
    chainFamily: 'solana',
    why: 'Where Tenda started — settlement fast enough to feel like handing over cash.',
    proofs: [
      { label: 'Native escrow program, written in Anchor' },
      { label: 'SOL gas grants so first-time users start at zero' },
      { label: 'Solana Mobile (Seeker) owners pay 1% instead of 2.5% — on every chain' },
      { label: 'Connects through Mobile Wallet Adapter — Phantom, Solflare and the rest' },
    ],
  },
  {
    chainFamily: 'base',
    why: 'USDC-native rails and the shortest path from a Coinbase account to a Tenda gig.',
    proofs: [
      { label: 'TendaEscrow Solidity contracts, deployed with a full Foundry test suite' },
      { label: 'Gasless USDC approvals via EIP-2612 permit' },
      { label: 'Sponsored gas for first-time users', roadmap: true },
    ],
  },
  {
    chainFamily: 'celo',
    why: 'A chain designed for exactly Tenda’s users — mobile-first, stablecoin-first, emerging markets first.',
    proofs: [
      { label: 'Gas paid in USDC via Celo’s feeCurrency — verified on-chain' },
      { label: 'Same escrow contracts, same USDC, zero extra tokens to hold' },
      { label: 'cUSD tradable on the exchange alongside USDC and CELO' },
    ],
  },
] as const

export const ECOSYSTEMS_HEADER = {
  eyebrow: 'Multichain · one escrow, three ecosystems',
  h2: { lead: 'Built deep into every chain', emphasis: 'we ship on.' },
  sub: 'Tenda isn’t "deployed to" these chains — it uses what makes each one special: Solana’s speed, Base’s USDC rails, Celo’s stablecoin gas. Same product, same guarantees, everywhere.',
} as const
