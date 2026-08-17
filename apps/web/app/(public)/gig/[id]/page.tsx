import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { APP_INFO, formatAssetAmount, gigPlaceLabel } from '@tenda/shared'
import { GigBrief } from '@/components/gig/detail/GigBrief'
import { GigDetailHeader } from '@/components/gig/detail/GigDetailHeader'
import { GigDetailSection } from '@/components/gig/detail/GigDetailSection'
import { GigEscrowAside } from '@/components/gig/detail/GigEscrowAside'
import { GigPosterCard } from '@/components/gig/detail/GigPosterCard'
import { GigProofList } from '@/components/gig/detail/GigProofList'
import { GigTerms } from '@/components/gig/detail/GigTerms'
import { GIG_DETAIL_COPY } from '@/components/gig/detail/copy'
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
  const where = gigPlaceLabel(gig)
  const description =
    gig.description !== null && gig.description !== ''
      ? gig.description.slice(0, 160)
      : `${amount} escrow-secured gig on ${APP_INFO.name} · ${where}`
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
 * Tier-1 public detail (comp lines 547-683). Anonymous fetch by construction;
 * a hidden or unknown gig 404s (Next adds noindex to 404 responses).
 * Party-scoped fields are never read by anything on this page — see GigTerms.
 */
export default async function GigDetailPage({ params }: Params) {
  const { id } = await params
  const gig = await getGig(id)
  if (gig === null) notFound()

  return (
    <div className="mx-auto w-full max-w-content px-6 pb-24 pt-8">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-14">
        <article>
          <GigDetailHeader gig={gig} />

          <GigDetailSection title={GIG_DETAIL_COPY.brief}>
            <GigBrief description={gig.description} />
          </GigDetailSection>

          <GigDetailSection title={GIG_DETAIL_COPY.terms}>
            <GigTerms gig={gig} />
          </GigDetailSection>

          <GigDetailSection title={GIG_DETAIL_COPY.proof}>
            <GigProofList requirements={gig.proof_requirements} />
          </GigDetailSection>

          <GigDetailSection title={GIG_DETAIL_COPY.postedBy}>
            <GigPosterCard creator={gig.creator} />
          </GigDetailSection>
        </article>

        <GigEscrowAside gig={gig} />
      </div>
    </div>
  )
}
