import { ImageResponse } from 'next/og'
import { APP_INFO, formatAssetAmount } from '@tenda/shared'
import { getGig } from '@/lib/gigs/data'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = `${APP_INFO.name} gig`

/**
 * Dynamic unfurl card: title + amount + place on the brand's warm-paper
 * ground (the stage-1 doc's second og:image option). Values are inlined —
 * a strict-CSP-style rule applies here too: no external fetches.
 */
export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gig = await getGig(id)
  const title = gig?.title ?? `Gig on ${APP_INFO.name}`
  const amount = gig !== null ? formatAssetAmount(gig.amount_raw, gig.asset) : ''
  const where = gig === null ? '' : gig.remote ? 'Remote' : gig.city ?? gig.country ?? ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#F7F5F0',
          color: '#141721',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#2E5BD6' }}>{APP_INFO.name}</div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
          {title.length > 70 ? `${title.slice(0, 70)}…` : title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 40 }}>
          {amount !== '' && <span style={{ color: '#197D55', fontWeight: 700 }}>{amount}</span>}
          {where !== '' && <span style={{ color: '#4E525B' }}>{where}</span>}
          <span style={{ marginLeft: 'auto', color: '#646872', fontSize: 30 }}>
            Escrow-secured gig
          </span>
        </div>
      </div>
    ),
    size,
  )
}
