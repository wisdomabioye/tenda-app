/**
 * The listing terms, and ONLY the listing terms (comp lines 609-621).
 *
 * Party-scoped fields (counterparty, proofs, dispute) are deliberately never
 * read here: the public page renders identically whether the server withheld
 * them or the gig simply has none, so there is no code path where a leak
 * could become visible.
 */
import {
  chainLabel,
  formatAssetAmount,
  formatDuration,
  formatRelativeShort,
  gigPlaceLabel,
  type GigDetail,
} from '@tenda/shared'
import { GIG_DETAIL_COPY } from './copy'

interface Term {
  label: string
  value: string
  /** Figures are set in mono with tabular numerals — the brief's one rule. */
  numeric?: boolean
}

/**
 * `Intl` with an explicit locale and time zone: a deadline rendered by the
 * SERVER in one zone and re-rendered by the client in another is a hydration
 * mismatch, and on this field it would also be a different moment.
 */
const DEADLINE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

export function gigTerms(gig: GigDetail): Term[] {
  const terms: Term[] = [
    {
      label: GIG_DETAIL_COPY.terminology.payment,
      value: formatAssetAmount(gig.amount_raw, gig.asset),
      numeric: true,
    },
    { label: GIG_DETAIL_COPY.terminology.chain, value: chainLabel(gig.chain_id) },
    { label: GIG_DETAIL_COPY.terminology.location, value: gigPlaceLabel(gig) },
  ]
  if (gig.completion_duration_seconds !== null) {
    terms.push({
      label: GIG_DETAIL_COPY.terminology.deliverWithin,
      value: formatDuration(gig.completion_duration_seconds),
      numeric: true,
    })
  }
  if (gig.accept_deadline !== null) {
    terms.push({
      label: GIG_DETAIL_COPY.terminology.acceptingUntil,
      value: DEADLINE_FORMAT.format(new Date(gig.accept_deadline)),
      numeric: true,
    })
  }
  if (gig.created_at !== null) {
    terms.push({
      label: GIG_DETAIL_COPY.terminology.posted,
      value: formatRelativeShort(gig.created_at),
      numeric: true,
    })
  }
  return terms
}

export function GigTerms({ gig }: { gig: GigDetail }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-8 gap-y-6">
      {gigTerms(gig).map((term) => (
        <div key={term.label}>
          <dt className="mb-1 text-[13px] leading-[18px] text-content-tertiary">{term.label}</dt>
          <dd
            className={`font-semibold text-content-primary ${term.numeric ? 'font-numeric' : ''}`}
          >
            {term.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
