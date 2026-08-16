'use client'

/**
 * Pre-sign confirm gate for a wallet-opening transition (port of mobile's
 * components/escrow/tx-action/TxConfirmDialog). Thin wrapper over the shared
 * ConfirmDialog: it derives the kind-aware copy (effect + amount + "your
 * wallet opens next") from the action via the shared copy table, so screens
 * only own the `pendingAction` state and the confirm handler. Renders
 * nothing for a null action or one that isn't gated (see txConfirmCopy).
 */
import { txConfirmCopy, type EscrowTxType, type TxConfirmContext } from '@tenda/shared'
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog'

export function TxConfirmDialog({
  action,
  ctx,
  loading = false,
  onConfirm,
  onCancel,
}: {
  action: EscrowTxType | null
  ctx: TxConfirmContext
  /** Busy state on the confirm button while the follow-on tx is being built. */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const copy = action !== null ? txConfirmCopy(action, ctx) : null
  return (
    <ConfirmDialog
      open={copy !== null}
      title={copy?.title ?? ''}
      message={copy?.body}
      confirmLabel={copy?.confirmLabel ?? ''}
      destructive={copy?.destructive ?? false}
      busy={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
