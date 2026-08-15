/**
 * Brand facts — the ONLY source of product identity strings and outbound
 * links, shared by mobile, web and the landing page (which composes these
 * with its release-specific facts: version, APK url, about copy).
 *
 * Consolidated 2026-08-15 from apps/mobile/lib/app-info.ts and
 * apps/tendahq/src/content/app-info.ts, which had already drifted apart.
 * Release/distribution facts (version, apkUrl) deliberately stay in the
 * landing page's own file — scripts/check-app-version.mjs gates them there
 * against app.json.
 */
export const APP_INFO = {
  name: 'Tenda',
  tagline: 'Get paid. No middlemen.',
  description:
    'Post or accept gigs with instant on-chain escrow. Proof required. Payment guaranteed.',

  fees: {
    /**
     * STATIC COPY ONLY (support/marketing screens). Live surfaces must read
     * GET /v1/platform/config — the platform_config table is the runtime
     * truth and this number can lag it.
     */
    platformFeePct: 2.5,
  },

  support: {
    whatsapp: 'https://chat.whatsapp.com/EeB5OMalNy0EbMlU4QPZMr?mode=hq2tcli',
    email: 'hello@tendahq.com',
  },

  legal: {
    terms: 'https://tendahq.com/terms',
    privacy: 'https://tendahq.com/privacy',
  },

  social: {
    twitter: 'https://x.com/tendahq',
    instagram: 'https://instagram.com/tendahq',
    telegram: 'https://t.me/tendahq',
  },

  external: {
    website: 'https://tendahq.com',
    tendaPlayStore: 'https://play.google.com/store/apps/details?id=com.tendahq.mobile',
  },

  wallets: {
    phantom: {
      name: 'Phantom',
      playStore: 'https://play.google.com/store/apps/details?id=app.phantom',
    },
    solflare: {
      name: 'Solflare',
      playStore: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
    },
  },
} as const

export type AppInfo = typeof APP_INFO
