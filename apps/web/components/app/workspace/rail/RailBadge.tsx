/**
 * Unread pip on a rail item. Caps at 9+ exactly like the previous top-nav
 * shell did, so a busy inbox never widens the 40px rail slot.
 *
 * Fill is --feedback-danger-SOLID, not the comp's --feedback-danger-base:
 * base is tuned for text/borders and lightens to #F0706E on dark, where white
 * on it measures 2.90 (fails AA). The solid variant exists for exactly this
 * and holds 4.99 light / 4.64 dark. Text is --brand-on-primary, the token
 * that is #FFFFFF in BOTH themes — --content-inverse flips to near-black on
 * dark and would put dark text on a red pip.
 */
const BADGE_CAP = 9

export function railBadgeLabel(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count)
}

export function RailBadge({ count }: { count: number }) {
  // Nothing to announce and nothing to draw below 1 — a "0" pip reads as an
  // alert that is not there.
  if (count < 1) return null
  return (
    <span
      aria-hidden
      className="animate-fadein absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-feedback-danger-solid px-0.5 font-numeric text-[10px] font-bold leading-none text-brand-on-primary"
    >
      {railBadgeLabel(count)}
    </span>
  )
}
