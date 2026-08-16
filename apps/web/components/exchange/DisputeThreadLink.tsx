import Link from 'next/link'

/** Dispute reason block with the party-only way into the mediation thread. */
export function DisputeThreadLink({
  reason,
  escrowId,
  isParty,
}: {
  reason: string
  escrowId: string
  isParty: boolean
}) {
  return (
    <section className="flex flex-col gap-1 rounded-card border border-feedback-warning-base/40 bg-feedback-warning-surface p-4">
      <h2 className="text-sm font-semibold text-feedback-warning-text">Dispute raised</h2>
      <p className="text-sm text-feedback-warning-text/90">{reason}</p>
      {isParty && (
        <Link
          href={`/dispute/${escrowId}`}
          className="text-sm font-semibold text-brand-primary underline-offset-2 hover:underline"
        >
          Open the mediation thread
        </Link>
      )}
    </section>
  )
}
