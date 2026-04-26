import type { EscrowMini } from '@/data/mock-feed'
import { CATEGORIES } from '@/data/categories'
import { CURRENCIES } from '@/data/currencies'
import { cn } from '@/lib/cn'

interface Props {
  mini: EscrowMini
  className?: string
}

const STATUS_TONE: Record<EscrowMini['status'], { tokenSurface: string; tokenText: string; label: string }> = {
  locked:  { tokenSurface: 'var(--success-surface)', tokenText: 'var(--success)', label: 'Locked' },
  open:    { tokenSurface: 'var(--success-surface)', tokenText: 'var(--success)', label: 'Open' },
  funding: { tokenSurface: 'var(--warning-surface)', tokenText: 'var(--warning)', label: 'Funding' },
}

/**
 * Small (~200w) escrow card used in the hero EscrowWall. Two render orderings:
 *   - exchange variant (has `arrow`): pill → SOL amount → fiat arrow → category → who
 *   - gig variant (no `arrow`):       pill → category → SOL amount → who
 *
 * Mirrors the wireframe in Tenda V2/landing/sections/01-hero-final.html, scaled
 * to the same proportions (200w × ~150h). All colours go through theme tokens
 * so the wall reads correctly under both light and dark page themes — the
 * EscrowWall vignette mask uses --surface-bg for the same reason.
 */
export function MockEscrowMini({ mini, className }: Props) {
  const tone = STATUS_TONE[mini.status]
  const cat = CATEGORIES[mini.category]
  const isExchange = !!mini.arrow

  return (
    <div
      className={cn(
        'rounded-[14px] border p-3.5 text-[10px]',
        'border-[var(--border-default)] bg-[var(--surface-card)] backdrop-blur-sm',
        'shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className="mono-sm inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em]"
          style={{ background: tone.tokenSurface, color: tone.tokenText, fontSize: 9 }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: 'currentColor' }} />
          {tone.label}
        </span>
        <span className="mono-sm text-[var(--content-secondary)]" style={{ fontSize: 10 }}>
          {mini.timer}
        </span>
      </div>

      {isExchange ? (
        <ExchangeBody mini={mini} catId={cat.id} catEmoji={cat.emoji} />
      ) : (
        <GigBody mini={mini} catLabel={cat.label} catId={cat.id} catEmoji={cat.emoji} />
      )}

      <div className="mono-sm mt-1.5 text-[var(--content-tertiary)]" style={{ fontSize: 9.5 }}>
        {mini.who}
      </div>
    </div>
  )
}

function ExchangeBody({ mini, catId, catEmoji }: { mini: EscrowMini; catId: string; catEmoji: string }) {
  const fiat = mini.arrow!
  return (
    <>
      <div
        className="mono mt-2 text-[var(--content-primary)]"
        style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.1 }}
      >
        {mini.amountSol.toFixed(mini.amountSol >= 1 ? 3 : 2)} SOL
      </div>
      <div
        className="mono mt-0.5 text-[var(--content-tertiary)]"
        style={{ fontSize: 10 }}
      >
        → {fiat.fiatAmount.toLocaleString()} {fiat.currency} {CURRENCIES[fiat.currency].flag}
      </div>
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase"
        style={{
          background: `var(--cat-${catId}-surface)`,
          color: `var(--cat-${catId}-text)`,
          fontSize: 9,
          letterSpacing: '0.06em',
        }}
      >
        {catEmoji} Exchange
      </span>
    </>
  )
}

function GigBody({ mini, catLabel, catId, catEmoji }: { mini: EscrowMini; catLabel: string; catId: string; catEmoji: string }) {
  return (
    <>
      <span
        className="mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase"
        style={{
          background: `var(--cat-${catId}-surface)`,
          color: `var(--cat-${catId}-text)`,
          fontSize: 9,
          letterSpacing: '0.06em',
        }}
      >
        {catEmoji} {catLabel}
      </span>
      <div
        className="mono mt-2 text-[var(--content-primary)]"
        style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.1 }}
      >
        {mini.amountSol.toFixed(2)} SOL
      </div>
    </>
  )
}
