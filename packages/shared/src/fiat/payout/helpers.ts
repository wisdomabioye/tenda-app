import type { PayoutFieldOption } from './types'

/**
 * Reusable payout-field validators + masking, composed by each country spec's
 * `validate`/`maskAccountNumber` so the per-country files stay declarative and
 * free of duplicated parsing logic.
 */

/** Non-empty (after trim), else a "<label> is required" message. */
export function requireNonEmpty(value: string, label: string): string | null {
  return value.trim().length > 0 ? null : `${label} is required`
}

/**
 * All-digits with an exact length or an inclusive [min,max] range, else a
 * message naming the expectation. Empty input reports "required" first.
 */
export function requireDigits(
  value: string,
  label: string,
  opts: { exact?: number } | { min: number; max: number },
): string | null {
  const v = value.trim()
  if (v.length === 0) return `${label} is required`
  if (!/^\d+$/.test(v)) return `${label} must contain digits only`
  if ('exact' in opts && opts.exact !== undefined) {
    return v.length === opts.exact ? null : `${label} must be ${opts.exact} digits`
  }
  if ('min' in opts) {
    return v.length >= opts.min && v.length <= opts.max
      ? null
      : `${label} must be ${opts.min}–${opts.max} digits`
  }
  return null
}

/** Value must be one of the option ids, else a message. */
export function requireOption(value: string, options: PayoutFieldOption[], label: string): string | null {
  return options.some((o) => o.value === value) ? null : `${label} is not valid`
}

/** Mask all but the last `visible` characters ('0123456789' → '•••••• 6789'). */
export function maskTail(value: string, visible = 4): string {
  const v = value.trim()
  if (v.length <= visible) return v
  return `${'•'.repeat(v.length - visible)} ${v.slice(-visible)}`
}

/**
 * IBAN, checked properly: country prefix, exact length, and the ISO 13616
 * mod-97 checksum.
 *
 * The checksum is the point. A length check alone accepts a transposed pair of
 * digits, and an IBAN is the ONE field where a typo does not bounce — it either
 * fails at the bank days later or, with the wrong check digits, reaches a
 * different account. Mod-97 catches every single-digit error and every
 * transposition, which is what it was designed for.
 *
 * Spaces and case are normalised because people paste IBANs in the grouped
 * form their bank prints them in ("AE07 0331 2345 6789 0123 456").
 */
export function requireIban(
  value: string,
  label: string,
  opts: { country: string; length: number },
): string | null {
  const iban = value.replace(/\s+/g, '').toUpperCase()
  if (iban.length === 0) return `${label} is required`
  if (!iban.startsWith(opts.country)) return `${label} must start with ${opts.country}`
  if (iban.length !== opts.length) return `${label} must be ${opts.length} characters`
  if (!/^[A-Z0-9]+$/.test(iban)) return `${label} must contain letters and digits only`
  return mod97(iban) === 1 ? null : `${label} is not a valid IBAN — check for a typo`
}

/**
 * ISO 13616 check: move the first four characters to the end, map letters to
 * two-digit numbers (A=10 … Z=35), and take the whole thing mod 97.
 *
 * Reduced digit-by-digit rather than via BigInt because an IBAN is up to 34
 * characters, so the expanded numeric string exceeds Number.MAX_SAFE_INTEGER
 * and a single `%` on a parsed number would silently lose precision.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const code = char.charCodeAt(0)
    // 'A'..'Z' → 10..35, '0'..'9' → 0..9
    const chunk = code >= 65 ? String(code - 55) : char
    for (const digit of chunk) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder
}
