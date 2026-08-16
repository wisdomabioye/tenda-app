'use client'

/**
 * The one overlay skeleton every dialog composes — web twin of mobile's
 * ui/overlay/ModalBackdrop. Owns the full-screen dim layer, the centered
 * card, and the aria contract (`role` + `aria-modal` + label), so no dialog
 * hand-rolls `fixed inset-0` again.
 *
 * Dismissal is ONE opt-in concept: pass `onBackdropClick` and both the dim
 * layer's click AND Escape dismiss (clicks on the CARD never bubble out).
 * Dialogs that must not be dismissed mid-flight (transaction progress, busy
 * confirms) simply omit it and lock every way out at once.
 */
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ModalBackdrop({
  role = 'dialog',
  label,
  onBackdropClick,
  strongDim = false,
  cardClassName,
  children,
}: {
  role?: 'dialog' | 'alertdialog'
  /** Accessible name for the dialog card. */
  label: string
  /** Clicking the dim layer. Omit to make the backdrop inert. */
  onBackdropClick?: () => void
  /** bg-black/60 (progress/blocking dialogs) instead of the default /50. */
  strongDim?: boolean
  /** Card extras: width cap, gap, text alignment, scroll behaviour. */
  cardClassName?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (onBackdropClick === undefined) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBackdropClick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBackdropClick])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        strongDim ? 'bg-black/60' : 'bg-black/50',
      )}
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        role={role}
        aria-modal="true"
        aria-label={label}
        className={cn(
          'flex w-full flex-col rounded-card border border-border-subtle bg-surface-card p-6 shadow-lg',
          cardClassName ?? 'max-w-sm gap-4',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
