/**
 * §07 Supported networks — the technical reference for the chains Tenda
 * settles on.
 *
 * DELIBERATELY NOT THE ECOSYSTEMS SECTION. That one answers "why does Tenda
 * build here", written for users judging whether this is real and for
 * ecosystem teams judging whether it is worth backing. This one answers "what
 * exactly am I connecting to" — chain id, gas token, transport, explorer — and
 * every value is read from the shared manifest, so a chain added there appears
 * here with no edit.
 *
 * WHAT THIS SECTION DOES NOT DO, on purpose: offer to add a network to the
 * visitor's wallet. `wallet_addEthereumChain` is EVM-only, so it could never
 * cover Solana and would leave one of three chains conspicuously unserved;
 * Base and Celo already ship in the default network list of every major
 * wallet; it needs an injected provider, which on a mobile-first product is
 * almost nobody; and a landing visitor has no account yet, so there is nothing
 * for a configured network to be used for. The place that affordance earns is
 * apps/web at connect time, gated on an injected provider and shown when the
 * user is actually on the wrong chain.
 *
 * NOR DOES IT EDITORIALISE GAS. Base's manifest `gasPolicy` is 'paymaster',
 * and that rail is not live — a table row rendering the policy name would
 * imply sponsorship that does not exist. The gas story has its own section,
 * where features.ts already gates the copy on the policies that actually ship.
 * Here the only gas fact is the native token's symbol, which is true today on
 * every chain.
 */

export const NETWORKS_HEADER = {
  eyebrow: 'Networks',
  h2: { lead: 'Settlement runs on', emphasis: 'these chains.' },
  sub: 'Escrow is a contract on each of them — not a balance we hold for you. Chain ids are CAIP-2, the same identifiers the app and API use.',
} as const

/** Column headings for the network rows. */
export const NETWORK_LABELS = {
  chainId: 'Chain id',
  gasToken: 'Gas token',
  transport: 'Wallet',
  explorer: 'Explorer',
} as const

/** Shown on the copy control before and after a successful copy. */
export const COPY_LABELS = { idle: 'Copy chain id', done: 'Copied' } as const

/** Trailing note under the grid. */
export const NETWORKS_FOOTNOTE =
  'Adding a chain is a manifest entry and its secrets — no client release. Testnets exist for development and are never listed here.'
