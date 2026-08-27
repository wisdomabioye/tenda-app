/**
 * Landing-page app facts. Brand identity (name, tagline, description, social
 * links) comes from @tenda/shared's APP_INFO — the monorepo's single source of
 * brand truth — via the same source-alias mechanism as chains. ONLY facts that
 * are release- or landing-specific live here: the RELEASE literals (gated
 * against app.json by scripts/check-app-version.mjs), the long-form about copy,
 * and distribution placeholders.
 */

import { APP_INFO as BRAND } from '@tenda/shared/app-info'
import { releaseStage, versionNumber } from '@/lib/release'
import { CHAIN_NAMES_LINE } from './chains'

/**
 * The network-stage label and the display version are DERIVED from the release
 * qualifier `bump-version.mjs` stamps (see lib/release.ts), not typed out
 * again. The stage used to be hand-written here AND, independently, in the
 * footer's legal disclaimer — exactly the pair that goes stale in opposite
 * directions on launch day.
 */

/**
 * The two release literals `scripts/bump-version.mjs` rewrites and
 * `scripts/check-app-version.mjs` gates against app.json.
 *
 * They MUST stay single-quoted literals, and each key must appear in its
 * quoted form exactly ONCE in this whole file: both scripts use
 * replaceOnce/matchOnce over a regex matching the key followed by a quoted
 * string, and that throws on zero or two matches. Referencing them below as
 * RELEASE.version is safe — an unquoted value doesn't match — but writing the
 * quoted form again anywhere, PROSE IN THIS COMMENT INCLUDED, breaks the gate.
 * Never edit them by hand; run `pnpm bump:version <patch|minor|major>`.
 */
const RELEASE = {
  version: 'v0.4.3-testnet',
  apkUrl: 'https://github.com/wisdomabioye/tenda-app/releases/download/v0.4.3-testnet/0.4.3-testnet.apk',
} as const

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
  apkUrl: RELEASE.apkUrl,
  appStoreUrl: '#',
  playStoreUrl: '#',
  qrTarget: 'tenda.so/get',

  /** Build / release. */
  version: RELEASE.version,
  /** `v0.4.3` — the version without its release qualifier. */
  versionNumber: versionNumber(RELEASE.version),
  buildLocation: 'Lagos',

  /** Chain identity surfaced in section metas + footer status. */
  chains: {
    /** "Solana · Base · Celo" — derived from the shared CHAIN_MANIFEST. */
    networksLine: CHAIN_NAMES_LINE,
    /** Release stage qualifier shown next to the network line. */
    stage: releaseStage(RELEASE.version),
    /** Where to read the contracts. */
    contractsUrl: 'https://github.com/wisdomabioye/tenda-app/tree/main/contracts',
  },

  /** Social — brand truth, one source. */
  twitterUrl: BRAND.social.twitter,
  whatsappUrl: BRAND.support.whatsapp,
  discordUrl: '#',
  githubUrl: 'https://github.com/wisdomabioye/tenda-app',
  telegramUrl: BRAND.social.telegram,
} as const

export type AppInfo = typeof APP_INFO
