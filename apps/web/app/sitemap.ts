import type { MetadataRoute } from 'next'
import { listGigs } from '@/lib/gigs/data'
import { siteUrl } from '@/lib/config/site-url'

// Without this the build prerenders the sitemap ONCE (with whatever the feed
// returned at build time — possibly the outage fallback) and never refreshes.
export const dynamic = 'force-dynamic'

/**
 * Driven by the public feed, which only ever serves open, non-hidden gigs —
 * so a taken-down gig can never appear here. Capped at one page of the
 * feed's newest rows; older gigs are reached through the feed itself.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: new URL('/gigs', base).toString(), changeFrequency: 'hourly', priority: 1 },
  ]
  try {
    const page = await listGigs({ limit: 100, sort: 'created_at' })
    const gigEntries: MetadataRoute.Sitemap = page.data.map((gig) => ({
      url: new URL(`/gig/${gig.escrow_id}`, base).toString(),
      lastModified: gig.created_at ?? undefined,
      changeFrequency: 'hourly',
      priority: 0.8,
    }))
    return [...staticEntries, ...gigEntries]
  } catch {
    // A feed outage must not break the whole sitemap route.
    return staticEntries
  }
}
