'use client'

/**
 * "The provider needs to verify you."
 *
 * `kyc_required` and `kyc_url` are on the intent wire and mobile's screen
 * ignores both — so a reader whose cash-out is paused pending verification is
 * shown a spinner-ish "waiting for the provider" and given no way to act. This
 * says what is blocking and links the provider's flow when there is one.
 *
 * Its own component rather than `AlertPanel`: needing to verify is not a
 * failure, and drawing it in danger colours with `role="alert"` would tell
 * someone their money is in trouble when it is merely waiting on them. It is
 * also not a new design-system tone — it is one block, used once, next to the
 * only thing that needs it.
 */
import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'

export function IntentKycNotice({
  title,
  body,
  action,
}: {
  title: string
  body: string
  /** The provider's verification link, when the rail has given us one. */
  action?: ReactNode
}) {
  return (
    <div className="mt-4 flex items-start gap-3.5 rounded-card border border-feedback-warning-border bg-feedback-warning-surface px-5 py-4">
      <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-feedback-warning-text" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-feedback-warning-text">{title}</p>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-[18px] text-feedback-warning-text opacity-90">
          {body}
        </p>
        {action !== undefined && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
