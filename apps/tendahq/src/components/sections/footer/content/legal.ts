/**
 * Legal foot — copyright + disclaimer + Terms / Privacy.
 *
 * Both variable facts are DERIVED, not typed: the chain list from the shared
 * CHAIN_MANIFEST, and the release stage from the version suffix that
 * bump-version.mjs stamps. This line used to hardcode "Solana, Base and Celo"
 * and "Testnet release" independently of the two places that already knew
 * both, so adding a chain or cutting a mainnet release left the legal
 * disclaimer — of all things — the last stale text on the page.
 *
 * Product + legal review before public mainnet may want to refine the wording;
 * the facts inside it now maintain themselves.
 */

import { APP_INFO, MAINNET_STATUS_CLAUSE } from '@/content'

export const FOOTER_LEGAL = {
  copyright: `© ${new Date().getFullYear()} Tenda.`,
  // The stage is parenthesised rather than sentence-initial on purpose: it
  // renders lowercase ("testnet release" / "mainnet"), so a position that
  // demands a capital would read as a typo in one of the two states.
  // The chain list is GONE from this sentence, replaced by the deployment
  // clause. It named four mainnet chains as the ones the contracts execute on,
  // and the contracts were on none of them — a disclaimer is the last text on
  // a page that may state something the product cannot back.
  disclaimer:
    `Tenda is a software interface; settlement is executed on-chain by the Tenda escrow contracts (${APP_INFO.chains.stage} · ${MAINNET_STATUS_CLAUSE}). Tenda never holds your funds and never holds fiat — cash trades settle directly between the two parties. Crypto products may not be available in all regions. Not financial advice.`,
  links: [
    { label: 'Terms',   href: '/terms'   },
    { label: 'Privacy', href: '/privacy' },
  ],
} as const
