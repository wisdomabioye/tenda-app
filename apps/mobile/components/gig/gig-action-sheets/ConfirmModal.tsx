import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export type ConfirmKind = 'accept' | 'cancel' | 'delete' | 'refund'

const COPY: Record<ConfirmKind, { title: string; body: string }> = {
  accept: {
    title: 'Accept this gig?',
    // Fallback only — the accept body is normally built from the gig's actual
    // "deliver within" duration (see acceptBody).
    body: 'Once you accept, you must deliver within the agreed time window.',
  },
  cancel: { title: 'Cancel this gig?', body: 'The escrow will be refunded to your wallet on-chain.' },
  refund: {
    title: 'Claim refund?',
    body: 'The escrowed funds will be returned to your wallet. This cannot be undone.',
  },
  delete: { title: 'Delete this draft?', body: 'This action cannot be undone.' },
}

/**
 * Accept copy names the concrete "deliver within" window (e.g. "2 days") so the
 * worker commits with the real deadline in front of them — not a vague
 * "deadline". Falls back to the generic line when the duration is unknown.
 */
function acceptBody(deliverWithin: string | null): string {
  if (deliverWithin === null) return COPY.accept.body
  return `Once you accept, you must deliver within ${deliverWithin}. Only accept if you can complete it in time.`
}

/**
 * Destructive/confirm dialog for the on-chain (and draft-delete) gig actions,
 * the gig-specific kind→copy wrapper over the shared `ConfirmDialog`.
 */
export function ConfirmModal({
  kind,
  deliverWithin = null,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind | null
  /** Human-readable completion window for the accept dialog (formatDuration). */
  deliverWithin?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const copy = kind !== null ? COPY[kind] : null
  const message = kind === 'accept' ? acceptBody(deliverWithin) : copy?.body
  return (
    <ConfirmDialog
      visible={kind !== null}
      title={copy?.title ?? ''}
      message={message}
      destructive={kind !== 'accept'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
