'use client'

/**
 * Web analogue of mobile's ConfirmDialog convention (never window.confirm):
 * a ModalBackdrop-composed alert with an explicit destructive variant and a
 * busy-disabled confirm. Backdrop click and Escape both cancel — except
 * while busy, when EVERY way out is locked (the request keeps running, so a
 * dialog that vanished mid-operation would be lying about it). Both
 * dismissals ride ModalBackdrop's one `onBackdropClick` seam.
 */
import { Button } from '../Button'
import { ModalBackdrop } from './ModalBackdrop'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <ModalBackdrop
      role="alertdialog"
      label={title}
      {...(busy ? {} : { onBackdropClick: onCancel })}
    >
      <h2 className="font-display text-lg font-bold text-content-primary">{title}</h2>
      {/* pre-line: tx-gate copy separates its wallet note with a blank line */}
      {message !== undefined && <p className="text-sm whitespace-pre-line text-content-secondary">{message}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" size="md" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={busy}
          className={destructive ? 'bg-feedback-danger-base hover:bg-feedback-danger-base/90' : undefined}
          onClick={onConfirm}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </ModalBackdrop>
  )
}
