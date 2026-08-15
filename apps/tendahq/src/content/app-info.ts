/**
 * Landing-page app facts. Brand identity (name, tagline, description, social
 * links) comes from @tenda/shared's APP_INFO — the monorepo's single source of
 * brand truth — via the same source-alias mechanism as chains. ONLY facts that
 * are release- or landing-specific live here: version + APK url (gated against
 * app.json by scripts/check-app-version.mjs — they must stay literal in this
 * file), the long-form about copy, and distribution placeholders.
 */

import { APP_INFO as BRAND } from '@tenda/shared/app-info'
import { CHAIN_NAMES_LINE } from './chains'

export const APP_INFO = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  description: BRAND.description,

  /**
   * Long-form "about" paragraph used in the footer wordmark column. Reads as
   * the brand's elevator pitch — written for a reader who arrives at the
   * footer without context.
   */
  about:
    `Tenda is the escrow-secured marketplace for gig work and P2P cash trades. The escrow contracts run on ${CHAIN_NAMES_LINE} — funds lock when work is posted and release the moment proof clears. Built for emerging markets first.`,

  /** Distribution. */
  apkUrl: 'https://github.com/wisdomabioye/tenda-app/releases/download/v0.4.3-testnet/0.4.3-testnet.apk',
  appStoreUrl: '#',
  playStoreUrl: '#',
  qrTarget: 'tenda.so/get',

  /** Build / release. */
  version: 'v0.4.3-testnet',
  buildLocation: 'Lagos',

  /** Chain identity surfaced in section metas + footer status. */
  chains: {
    /** "Solana · Base · Celo" — derived from the shared CHAIN_MANIFEST. */
    networksLine: CHAIN_NAMES_LINE,
    /** Release stage qualifier shown next to the network line. */
    stage: 'testnet release',
    /** Where to read the contracts. */
    contractsUrl: 'https://github.com/wisdomabioye/tenda-app',
  },

  /** Social — brand truth, one source. */
  twitterUrl: BRAND.social.twitter,
  whatsappUrl: BRAND.support.whatsapp,
  discordUrl: '#',
  githubUrl: '#',
  telegramUrl: BRAND.social.telegram,
} as const

export type AppInfo = typeof APP_INFO
