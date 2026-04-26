export interface SitemapLink {
  label: string
  href: string
  /** Open in new tab when true. */
  external?: boolean
  /** Tiny inline marker, e.g. "↗", "Soon", "PDF". */
  badge?: string
}

/**
 * Active footer nav — single horizontal row pre-launch. Once page count
 * grows, group into columns by uncommenting entries in
 * `./sitemap-future.ts` and switching back to the column grid.
 *
 * Community channels render as icon-only social anchors via
 * <FooterSocial />, separate from this list.
 */
export const FOOTER_NAV_LINKS: readonly SitemapLink[] = [
  { label: 'Products',     href: '/#products'     },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For who',      href: '/#for-who'      },
  { label: 'FAQ',          href: '/#faq'          },
  { label: 'Coverage',     href: '/#coverage'     },
] as const
