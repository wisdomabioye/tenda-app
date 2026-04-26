/**
 * Cross-section facts only — name, taglines, distribution URLs, social links,
 * version. Per-section copy lives in each section's content.ts. Per-marketplace
 * stats live in src/data/stats.ts.
 */

export const APP_INFO = {
  name: 'Tenda',
  tagline: 'Get paid. No middlemen.',
  description:
    'Post or accept gigs with instant on-chain escrow. Proof required. Payment guaranteed.',

  /** Distribution. */
  apkUrl: 'https://github.com/wisdomabioye/tenda-app/releases/download/v0.2.0-devnet/v0.2.0-devnet.apk',
  appStoreUrl: '#',
  playStoreUrl: '#',
  qrTarget: 'tenda.so/get',

  /** Build / release. */
  version: 'v0.2.0-devnet',
  buildLocation: 'Lagos',

  /** Solana chain identity surfaced in the proof band + footer status. */
  chain: {
    network: 'Solana · devnet',
    /** Truncated program id; full address goes in support docs, not the marketing site. */
    programIdShort: 'Tend…9k2A',
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
  },

  /** Social. */
  twitterUrl: 'https://x.com/tendahq',
  whatsappUrl: 'https://chat.whatsapp.com/EeB5OMalNy0EbMlU4QPZMr?mode=hq2tcli',
  discordUrl: '#',
  githubUrl: '#',
  telegramUrl: '#',
} as const

export type AppInfo = typeof APP_INFO
