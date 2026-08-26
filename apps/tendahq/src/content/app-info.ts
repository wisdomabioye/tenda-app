/**
 * Landing-page app facts. Brand identity (name, tagline, description, social
 * links) comes from @tenda/shared's APP_INFO — the monorepo's single source of
 * brand truth — via the same source-alias mechanism as chains. ONLY facts that
 * are release- or landing-specific live here: the RELEASE literals (gated
 * against app.json by scripts/check-app-version.mjs), the long-form about copy,
 * and distribution placeholders.
 */

import { APP_INFO as BRAND } from '@tenda/shared/app-info'
import { CHAIN_NAMES_LINE } from './chains'

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

/**
 * Which network this build talks to, DERIVED from the version's release
 * qualifier rather than typed out again.
 *
 * `bump-version.mjs` owns the version string, so the suffix it stamps already
 * answers "is this testnet or mainnet" — and a release cut with `--suffix ''`
 * is by definition the mainnet build. Deriving the label means one release bump
 * flips every network-stage line on the site at once. It used to be written by
 * hand here AND, independently, in the footer's legal disclaimer — exactly the
 * kind of pair that goes stale in opposite directions on launch day.
 */
function releaseStage(version: string): string {
  const dash = version.indexOf('-')
  return dash === -1 ? 'mainnet' : `${version.slice(dash + 1)} release`
}

/** Semver without the release qualifier — `v0.4.3-testnet` → `v0.4.3`. */
function versionNumber(version: string): string {
  const dash = version.indexOf('-')
  return dash === -1 ? version : version.slice(0, dash)
}

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
