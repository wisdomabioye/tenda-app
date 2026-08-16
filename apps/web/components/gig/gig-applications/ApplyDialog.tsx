'use client'

/**
 * The apply dialog — web port of mobile's ApplySheet: the optional pitch,
 * and the obligation the applicant is taking on. The obligation notice is
 * REQUIRED here, not polish: D2 makes an applicant accountable for a gig
 * they are assigned to, and this is the only moment that bargain can
 * honestly be stated. All copy is SHARED.
 */
import { useState } from 'react'
import {
  APPLICATION_MESSAGE_MAX_LENGTH,
  APPLY_MESSAGE_LABEL,
  APPLY_MESSAGE_PLACEHOLDER,
  APPLY_OBLIGATION,
  APPLY_SUBMIT_LABEL,
  APPLY_TITLE,
} from '@tenda/shared'
import { Button } from '@/components/ui/Button'
import { controlClassName } from '@/components/ui/TextField'
import { Modal } from '@/components/ui/overlay/Modal'

export function ApplyDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  /** Resolves true once the application is stored; the dialog closes on true. */
  onSubmit: (message: string | null) => Promise<boolean>
}) {
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    // Trimmed to null here as well as server-side: an all-whitespace pitch
    // and no pitch mean the same thing.
    const trimmed = message.trim()
    if (await onSubmit(trimmed === '' ? null : trimmed)) {
      setMessage('')
      onClose()
    }
  }

  return (
    <Modal open={open} title={APPLY_TITLE} onClose={onClose}>
      <p className="rounded-control bg-feedback-warning-surface px-3 py-2 text-xs text-feedback-warning-base">
        {APPLY_OBLIGATION}
      </p>
      <label className="flex flex-col gap-1 text-sm font-semibold text-control-input-label">
        {APPLY_MESSAGE_LABEL}
        <textarea
          className={`${controlClassName} min-h-24 resize-y`}
          placeholder={APPLY_MESSAGE_PLACEHOLDER}
          value={message}
          maxLength={APPLICATION_MESSAGE_MAX_LENGTH}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <Button variant="primary" size="lg" fullWidth disabled={busy} onClick={handleSubmit}>
        {busy ? 'Working…' : APPLY_SUBMIT_LABEL}
      </Button>
    </Modal>
  )
}
