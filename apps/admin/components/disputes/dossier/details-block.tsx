import { formatProofTypeList } from '@tenda/shared'
import type { AdminEscrowDossier } from '@tenda/shared'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

const dash = (v: string | null): string => (v !== null && v.trim() !== '' ? v : '—')

/**
 * Kind-specific detail record. Exactly one of gig/exchange is populated,
 * matching the escrow kind; renders whichever is present.
 */
export function DetailsBlock({ dossier }: { dossier: AdminEscrowDossier }) {
  if (dossier.gig !== null) {
    const g = dossier.gig
    const location = g.remote ? 'Remote' : dash([g.city, g.country].filter((p) => p).join(', ') || null)
    return (
      <dl className="space-y-1 text-sm">
        <Row label="Title" value={g.title} />
        <Row label="Category" value={g.category} />
        <Row label="Location" value={location} />
        {/* The bar the poster set. Without it a mediator cannot rule on
            "they never sent what I asked for" — only on what was sent. */}
        <Row label="Required proof" value={dash(formatProofTypeList(g.proof_requirements) || null)} />
        {g.description !== null && g.description.trim() !== '' && (
          <div className="pt-2">
            <dt className="mb-1 text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap break-words">{g.description}</dd>
          </div>
        )}
      </dl>
    )
  }
  if (dossier.exchange !== null) {
    const e = dossier.exchange
    return (
      <dl className="space-y-1 text-sm">
        <Row label="Fiat amount" value={`${e.fiat_amount} ${e.fiat_currency}`} />
        <Row label="Rate" value={e.rate} />
        <Row label="Payment window" value={`${Math.round(e.payment_window_seconds / 60)} min`} />
      </dl>
    )
  }
  return <p className="text-sm text-muted-foreground">No detail record for this escrow.</p>
}
