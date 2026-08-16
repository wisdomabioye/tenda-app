'use client'

/**
 * Web analogue of mobile's ConfirmDialog convention (never window.confirm):
 * a ModalBackdrop-composed alert with an explicit destructive variant and a
 * busy-disabled confirm. Backdrop click and Escape both cancel — except
 * while busy, when EVERY way out is locked (the request keeps running, so a
 * dialog that vanished mid-operation would be lying about it). Both
 * dismissals ride ModalBackdrop's one `onBackdropClick` seam.
 *
 * `figure` is the comps' money line: one large monospace amount under the
 * body, for gates where the number IS the decision.
 *
 * Initial focus deviates from the comp, which autofocuses Confirm. That is
 * fine for a benign gate and dangerous for a destructive one — a stray Enter
 * would fire the irreversible action. Destructive dialogs focus Cancel; the
 * rest focus Confirm.
 */
import { Button } from '../Button'
import { ModalBackdrop } from './ModalBackdrop'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  /** A headline amount, rendered in tabular monospace (comps' money line). */
  figure?: string
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
  figure,
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
      // Cancel is rendered first, Confirm last.
      initialFocus={destructive ? 'first' : 'last'}
      {...(busy ? {} : { onBackdropClick: onCancel })}
    >
      <h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.4px] text-content-primary">
        {title}
      </h2>
      {/* pre-line: tx-gate copy separates its wallet note with a blank line */}
      {message !== undefined && (
        <p className="whitespace-pre-line text-[15px] leading-[22px] text-content-secondary">
          {message}
        </p>
      )}
      {figure !== undefined && figure !== '' && (
        <p className="font-numeric text-[22px] font-bold leading-7 text-utility-money">{figure}</p>
      )}
      <div className="flex justify-end gap-2.5">
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
