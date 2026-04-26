import type { EscrowMini } from '@/data/mock-feed'
import { CATEGORIES } from '@/data/categories'
import { CURRENCIES } from '@/data/currencies'
import { cn } from '@/lib/cn'

interface Props {
  mini: EscrowMini
  className?: string
}

const STATUS_TONE: Record<EscrowMini['status'], { bg: string; text: string; label: string }> = {
  locked:  { bg: 'rgba(58,203,142,0.16)',  text: '#3ACB8E', label: 'Locked' },
  open:    { bg: 'rgba(58,203,142,0.16)',  text: '#3ACB8E', label: 'Open' },
  funding: { bg: 'rgba(240,163,101,0.18)', text: '#F0A365', label: 'Funding' },
}

/**
 * Small (~200w) escrow card used in the hero EscrowWall. Two render orderings:
 *   - exchange variant (has `arrow`): pill → SOL amount → fiat arrow → category → who
 *   - gig variant (no `arrow`):       pill → category → SOL amount → who
 *
 * Mirrors the wireframe in Tenda V2/landing/sections/01-hero-final.html, scaled
 * to the same proportions (200w × ~150h).
 */
export function MockEscrowMini({ mini, className }: Props) {
  const tone = STATUS_TONE[mini.status]
  const cat = CATEGORIES[mini.category]
  const isExchange = !!mini.arrow

  return (
    <div
      className={cn(
        'rounded-[14px] border p-3.5 text-[10px]',
        'border-[rgba(255,255,255,0.08)] bg-[rgba(22,27,41,0.85)] backdrop-blur-sm',
        'shadow-[0_12px_40px_rgba(0,0,0,0.30)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className="mono-sm inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em]"
          style={{ background: tone.bg, color: tone.text, fontSize: 9 }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: 'currentColor' }} />
          {tone.label}
        </span>
        <span className="mono-sm text-[#B6BAC5]" style={{ fontSize: 10 }}>
          {mini.timer}
        </span>
      </div>

      {isExchange ? (
        <ExchangeBody mini={mini} catId={cat.id} catEmoji={cat.emoji} />
      ) : (
        <GigBody mini={mini} catLabel={cat.label} catId={cat.id} catEmoji={cat.emoji} />
      )}

      <div className="mono-sm mt-1.5 text-[#6F7488]" style={{ fontSize: 9.5 }}>
        {mini.who}
      </div>
    </div>
  )
}

function ExchangeBody({ mini, catId, catEmoji }: { mini: EscrowMini; catId: string; catEmoji: string }) {
  const fiat = mini.arrow!
  return (
    <>
      <div className="mono mt-2 text-[#F4F2ED]" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.1 }}>
        {mini.amountSol.toFixed(mini.amountSol >= 1 ? 3 : 2)} SOL
      </div>
      <div className="mono mt-0.5 text-[#7A8096]" style={{ fontSize: 10 }}>
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
      <div className="mono mt-2 text-[#F4F2ED]" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.1 }}>
        {mini.amountSol.toFixed(mini.amountSol >= 1 ? 2 : 2)} SOL
      </div>
    </>
  )
}
