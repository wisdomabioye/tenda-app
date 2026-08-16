'use client'

/**
 * Live H:MM:SS countdown — web twin of mobile's shared DeadlineCountdown
 * over the SAME shared vocabulary: formatHMS for the clock and
 * countdownTone for the amber → red urgency shift as time runs out.
 * Recursive setTimeout (project rule — the delay is an idle gap),
 * settling on the expired label at zero.
 */
import { useEffect, useState } from 'react'
import { countdownTone, formatHMS, type CountdownTone } from '@tenda/shared'
import { cn } from '@/lib/cn'

function remainingMs(deadline: Date | string): number {
  return new Date(deadline).getTime() - Date.now()
}

/** Clock-digit colour per tone (mobile's toneFg, inline variant). */
const TONE_CLASS: Record<CountdownTone, string> = {
  normal: 'text-content-primary',
  warning: 'text-feedback-warning-base',
  danger: 'text-feedback-danger-base',
  expired: 'text-content-tertiary',
}

export function DeadlineCountdown({
  deadline,
  label,
  expiredLabel = 'Expired',
  className,
}: {
  deadline: Date | string
  label?: string
  expiredLabel?: string
  className?: string
}) {
  const [remaining, setRemaining] = useState(() => remainingMs(deadline))

  // A deadline PROP change resamples immediately (adjust-state-during-render,
  // the sanctioned derived-state pattern) — waiting for the next tick would
  // show the old deadline's clock for up to a second.
  const [lastDeadline, setLastDeadline] = useState(deadline)
  if (deadline !== lastDeadline) {
    setLastDeadline(deadline)
    setRemaining(remainingMs(deadline))
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      const next = remainingMs(deadline)
      setRemaining(next)
      if (next > 0) timer = setTimeout(tick, 1_000)
    }
    // First correction rides the first tick (the initializer already sampled
    // the clock) — a sync setState in the effect trips the cascading lint.
    timer = setTimeout(tick, 1_000)
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [deadline])

  const tone = countdownTone(remaining)
  if (tone === 'expired') {
    return <span className={cn('font-numeric', TONE_CLASS.expired, className)}>{expiredLabel}</span>
  }
  return (
    <span className={cn('font-numeric', className)}>
      {label !== undefined && <span className="text-content-tertiary">{label} </span>}
      <span className={cn('font-semibold', TONE_CLASS[tone])}>{formatHMS(remaining)}</span>
    </span>
  )
}
