import type { Pillar as PillarData, PillarAccent } from './content'
import { Placeholder } from '@/components/ui/Placeholder'
import { BorderlessMap, FeeBars, ProofReceipt, SpeedBars } from './PillarVisuals'

interface Props {
  pillar: PillarData
}

const ACCENT_TOKEN: Record<PillarAccent, string> = {
  brand:   'var(--brand)',
  service: 'var(--success)',
  errand:  'var(--accent)',
  content: 'var(--content-primary)',
}

const VISUALS = {
  'speed-bars':     SpeedBars,
  'proof-receipt':  ProofReceipt,
  'fee-bars':       FeeBars,
  'borderless-map': BorderlessMap,
} as const

export function Pillar({ pillar }: Props) {
  const accent = ACCENT_TOKEN[pillar.accent]
  const Visual = VISUALS[pillar.visual]

  return (
    <article className="group relative flex flex-col gap-5 px-6 pt-8 pb-7 transition-colors lg:px-8">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-[0.18] transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: accent }}
      />

      <p className="caption uppercase tracking-[0.16em]" style={{ color: accent }}>
        {pillar.num} · {pillar.tag}
      </p>

      <Visual />

      <h3 className="h3 text-[var(--content-primary)]">
        {pillar.headline.lead}{' '}
        <span style={{ color: accent }}>{pillar.headline.emphasis}</span>
      </h3>

      <p className="body text-[var(--content-secondary)]">{pillar.body}</p>

      <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
        <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
          {pillar.foot.label}
        </span>
        <span className="mono-sm font-semibold text-[var(--content-primary)]">
          {pillar.foot.placeholder ? (
            <Placeholder issue={pillar.foot.placeholder}>{pillar.foot.ref}</Placeholder>
          ) : (
            pillar.foot.ref
          )}
        </span>
      </div>
    </article>
  )
}
