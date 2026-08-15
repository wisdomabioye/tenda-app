import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Shared control skin — exported for non-input controls (select, OTP field). */
export const controlClassName =
  'w-full rounded-control border border-border-input bg-control-input-background px-4 py-3 text-sm text-control-input-text placeholder:text-control-input-placeholder focus:border-border-input-active focus:outline-none disabled:bg-control-disabled-background disabled:text-control-disabled-text'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
}

/** Labelled input with an inline error slot — the auth/profile form control. */
export function TextField({ label, error, className, ...props }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-control-input-label">
      {label}
      <input className={cn(controlClassName, className)} {...props} />
      {error != null && error !== '' && <span className="font-normal text-feedback-danger-text">{error}</span>}
    </label>
  )
}
