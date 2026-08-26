import { APP_INFO } from '@/content'
import { ENV } from '@/env'

export interface NavLink {
  label: string
  href: string
}

export const NAV_LINKS: readonly NavLink[] = [
  // Section IDs match each <SectionShell id="…"> in components/sections.
  // Gigs + Exchange are both covered by the single Two-Products section
  // (#products), so we don't ship a separate top-nav link for each.
  { label: 'Products',     href: '/#products'     },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Onboarding',   href: '/#onboarding'   },
  { label: 'Ecosystems',   href: '/#ecosystems'   },
  { label: 'FAQ',          href: '/#faq'          },
] as const

/**
 * Hand-off to the web app (apps/web). NOT a member of NAV_LINKS: those are
 * same-page section anchors rendered as plain text links, this leaves the
 * landing site entirely and is rendered as a CTA button beside "Download App".
 * The href is per-deployment (production vs Vercel preview), so it comes from
 * env rather than @/content — see ENV.webAppUrl.
 */
export const WEB_APP_LINK: NavLink = {
  label: 'Open Web App',
  href: ENV.webAppUrl,
}

export const NAV_LABELS = {
  brandAlt: 'Tenda',
  ctaDownload: 'Download App',
  toggleMenu: 'Toggle menu',
  toggleTheme: 'Toggle theme',
  mobileEyebrow: 'Navigate',
  mobileTagline: `Escrow-secured gigs & P2P on ${APP_INFO.chains.networksLine}`,
} as const
