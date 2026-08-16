import { unreadBadgeLabel } from '@tenda/shared'

/**
 * Unread pip on a rail item.
 *
 * The cap and the zero-suppression are a product-wide display rule, so they
 * come from shared `unreadBadgeLabel` rather than a fourth local copy of
 * `count > 9 ? '9+' : count`.
 *
 * Fill is --feedback-danger-SOLID, not the comp's --feedback-danger-base:
 * base is tuned for text/borders and lightens to #F0706E on dark, where white
 * on it measures 2.90 (fails AA). The solid variant exists for exactly this
 * and holds 4.99 light / 4.64 dark. Text is --brand-on-primary, the token
 * that is #FFFFFF in BOTH themes — --content-inverse flips to near-black on
 * dark and would put dark text on a red pip.
 */
export function RailBadge({ count }: { count: number }) {
  const label = unreadBadgeLabel(count)
  // Nothing to draw below 1 — a "0" pip reads as an alert that is not there.
  if (label === null) return null
  return (
    <span
      aria-hidden
      className="animate-fadein absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-feedback-danger-solid px-0.5 font-numeric text-[10px] font-bold leading-none text-brand-on-primary"
    >
      {label}
    </span>
  )
}
