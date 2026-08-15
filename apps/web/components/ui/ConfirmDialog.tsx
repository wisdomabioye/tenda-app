'use client'

/**
 * Web analogue of mobile's ConfirmDialog convention (never window.confirm):
 * a modal overlay with an explicit destructive variant and a busy-disabled
 * confirm. Backdrop click and Escape both cancel.
 */
import { useEffect } from 'react'
import { Button } from './Button'

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
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      // While busy, EVERY way out is locked — the Cancel button is disabled,
      // so Escape closing the dialog mid-operation would be an inconsistency
      // (the request keeps running with its dialog gone).
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-border-subtle bg-surface-card p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-content-primary">{title}</h2>
        {message !== undefined && <p className="text-sm text-content-secondary">{message}</p>}
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
      </div>
    </div>
  )
}
