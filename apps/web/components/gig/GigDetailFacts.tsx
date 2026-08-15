import {
  chainLabel,
  formatAssetAmount,
  formatPaymentWindow,
  formatRelativeShort,
  type GigDetail,
} from '@tenda/shared'

/**
 * The listing facts, and ONLY the listing facts. Party-scoped fields
 * (counterparty, proofs, dispute) are deliberately never read here — the
 * public page renders identically whether they are withheld or present.
 */
export function GigDetailFacts({ gig }: { gig: GigDetail }) {
  const facts: Array<{ label: string; value: string; numeric?: boolean }> = [
    { label: 'Payment', value: formatAssetAmount(gig.amount_raw, gig.asset), numeric: true },
    { label: 'Chain', value: chainLabel(gig.chain_id) },
    {
      label: 'Location',
      value: gig.remote ? 'Remote' : [gig.city, gig.country].filter(Boolean).join(', ') || 'Anywhere',
    },
  ]
  if (gig.completion_duration_seconds !== null) {
    facts.push({
      label: 'Time to complete',
      value: formatPaymentWindow(gig.completion_duration_seconds),
      numeric: true,
    })
  }
  if (gig.accept_deadline !== null) {
    facts.push({
      label: 'Accepting until',
      value: new Date(gig.accept_deadline).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
      numeric: true,
    })
  }
  if (gig.created_at !== null) {
    facts.push({ label: 'Posted', value: `${formatRelativeShort(gig.created_at)} ago` })
  }

  return (
    <dl className="grid grid-cols-2 gap-4 rounded-card border border-border-subtle bg-surface-card p-5 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col gap-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            {fact.label}
          </dt>
          <dd
            className={`text-sm font-semibold text-content-primary ${fact.numeric ? 'font-numeric' : ''}`}
          >
            {fact.value}
          </dd>
        </div>
      ))}
      {gig.proof_requirements.length > 0 && (
        <div className="col-span-full flex flex-col gap-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            Proof required
          </dt>
          <dd className="text-sm text-content-secondary">
            {gig.proof_requirements.join(', ')} evidence must be attached before submitting
          </dd>
        </div>
      )}
    </dl>
  )
}
