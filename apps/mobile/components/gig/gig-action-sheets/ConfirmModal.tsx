import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export type ConfirmKind = 'accept' | 'cancel' | 'delete' | 'refund'

const COPY: Record<ConfirmKind, { title: string; body: string }> = {
  accept: {
    title: 'Accept this gig?',
    body: 'You will be responsible for completing this gig within the deadline.',
  },
  cancel: { title: 'Cancel this gig?', body: 'The escrow will be refunded to your wallet on-chain.' },
  refund: {
    title: 'Claim refund?',
    body: 'The escrowed funds will be returned to your wallet. This cannot be undone.',
  },
  delete: { title: 'Delete this draft?', body: 'This action cannot be undone.' },
}

/**
 * Destructive/confirm dialog for the on-chain (and draft-delete) gig actions —
 * the gig-specific kind→copy wrapper over the shared `ConfirmDialog`.
 */
export function ConfirmModal({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const copy = kind !== null ? COPY[kind] : null
  return (
    <ConfirmDialog
      visible={kind !== null}
      title={copy?.title ?? ''}
      message={copy?.body}
      destructive={kind !== 'accept'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
