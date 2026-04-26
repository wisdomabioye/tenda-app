import { SectionShell } from '@/components/ui/SectionShell'
import { MOCK_GIG_CARDS, MOCK_OFFER_CARDS } from '@/data/mock-feed'
import {
  GIG_PANEL_SAMPLE_IDS,
  OFFER_PANEL_SAMPLE_ID,
  PRODUCT_PANELS,
} from './content'
import { ProductPanel } from './ProductPanel'
import { GigListRow } from './GigListRow'
import { OfferSummary } from './OfferSummary'
import { Bridge } from './Bridge'

/**
 * §03 Two products — side-by-side identity for Gigs (brand) and Exchange
 * (accent). Each panel embeds an authentic product visual lifted from the
 * mobile language: gigs panel renders 3 single-line gig rows; exchange panel
 * renders a labelled offer summary card. Section sits on the dark spine.
 */
export function TwoProducts() {
  const sampleGigs = GIG_PANEL_SAMPLE_IDS
    .map((id) => MOCK_GIG_CARDS.find((g) => g.id === id))
    .filter((g): g is (typeof MOCK_GIG_CARDS)[number] => Boolean(g))

  const sampleOffer = MOCK_OFFER_CARDS.find((o) => o.id === OFFER_PANEL_SAMPLE_ID)

  return (
    <SectionShell id="products" tone="dark" padY="lg">
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {PRODUCT_PANELS.map((panel) => (
          <ProductPanel key={panel.id} panel={panel}>
            {panel.id === 'gigs' ? (
              <div className="flex flex-col gap-2">
                {sampleGigs.map((gig) => (
                  <GigListRow key={gig.id} gig={gig} />
                ))}
              </div>
            ) : sampleOffer ? (
              <OfferSummary offer={sampleOffer} />
            ) : null}
          </ProductPanel>
        ))}
      </div>

      <Bridge />
    </SectionShell>
  )
}
