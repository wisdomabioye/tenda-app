export interface NavLink {
  label: string
  href: string
}

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Gigs',         href: '/#gigs' },
  { label: 'Exchange',     href: '/#exchange' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For who',      href: '/#for-who' },
  { label: 'FAQ',          href: '/#faq' },
] as const

export const NAV_LABELS = {
  brandAlt: 'Tenda',
  ctaDownload: 'Download App',
  toggleMenu: 'Toggle menu',
  toggleTheme: 'Toggle theme',
  mobileEyebrow: 'Navigate',
  mobileTagline: 'Trustless escrow for gigs on Solana',
} as const
