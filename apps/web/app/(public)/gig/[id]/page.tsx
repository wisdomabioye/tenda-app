import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { APP_INFO, formatAssetAmount } from '@tenda/shared'
import { CategoryBadge } from '@/components/gig/CategoryBadge'
import { GigCreatorLine } from '@/components/gig/GigCreatorLine'
import { GigDetailCta } from '@/components/gig/GigDetailCta'
import { GigDetailFacts } from '@/components/gig/GigDetailFacts'
import { getGig } from '@/lib/gigs/data'

type Params = { params: Promise<{ id: string }> }

/**
 * OG tags come from the SAME cached fetch that renders the body (getGig is
 * wrapped in React cache). These links get pasted into WhatsApp — the unfurl
 * is the front door.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const gig = await getGig(id)
  if (gig === null) return { title: 'Gig not found' }
  const amount = formatAssetAmount(gig.amount_raw, gig.asset)
  const where = gig.remote ? 'Remote' : gig.city ?? gig.country ?? ''
  const description =
    gig.description !== null && gig.description !== ''
      ? gig.description.slice(0, 160)
      : `${amount} escrow-secured gig on ${APP_INFO.name}${where !== '' ? ` · ${where}` : ''}`
  return {
    title: gig.title,
    description,
    openGraph: {
      title: gig.title,
      description,
      url: `/gig/${gig.escrow_id}`,
      siteName: APP_INFO.name,
      type: 'article',
    },
    twitter: { card: 'summary_large_image' },
  }
}

/**
 * Tier-1 public detail. Anonymous fetch by construction; a hidden or unknown
 * gig 404s (Next adds noindex to 404 responses). Party-scoped fields are
 * never rendered — see GigDetailFacts.
 */
export default async function GigDetailPage({ params }: Params) {
  const { id } = await params
  const gig = await getGig(id)
  if (gig === null) notFound()

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <CategoryBadge category={gig.category} />
          {gig.cross_border && (
            <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-semibold text-content-secondary">
              Cross-border
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-content-primary">
          {gig.title}
        </h1>
        <GigCreatorLine creator={gig.creator} />
      </header>

      <GigDetailFacts gig={gig} />

      {gig.description !== null && gig.description !== '' && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-semibold text-content-primary">
            About this gig
          </h2>
          <p className="whitespace-pre-line text-content-secondary">{gig.description}</p>
        </section>
      )}

      <GigDetailCta gig={gig} />

      <p className="text-xs text-content-tertiary">
        Payment is locked in an on-chain escrow before work starts and released on completion.
      </p>
    </article>
  )
}
