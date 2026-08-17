'use client'

/**
 * Web analogue of mobile's OtpCodeField: ONE input (autofill/one-time-code
 * friendly, one focus target for screen readers) styled as spaced digits.
 * Filters to digits, clamps to `length`, and reports completion once per fill.
 */
import { useRef, type Ref } from 'react'
import { controlClassName } from '@/components/ui'
import { cn } from '@/lib/cn'

interface OtpCodeFieldProps {
  value: string
  onChange: (digits: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  /**
   * So a caller can put the cursor back. A rejected code DISABLES this input
   * while the request is in flight, and a browser blurs a disabled element —
   * which drops focus to <body> exactly when the reader needs to retype.
   */
  ref?: Ref<HTMLInputElement>
  'aria-label'?: string
}

export function OtpCodeField({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  ref,
  'aria-label': ariaLabel = 'Verification code',
}: OtpCodeFieldProps) {
  const lastReported = useRef('')

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, length)
    if (digits === lastReported.current) return
    lastReported.current = digits
    onChange(digits)
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={length}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      placeholder={'•'.repeat(length)}
      className={cn(controlClassName, 'font-numeric text-center text-2xl tracking-[0.6em]')}
    />
  )
}
