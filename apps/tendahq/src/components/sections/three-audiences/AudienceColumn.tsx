import { ArrowRight, Smartphone } from 'lucide-react'
import { useFeePercents } from '@/hooks/usePlatformConfig'
import type { Audience, AudienceAccent, AudienceArtifact, AudienceKpi } from './content'
import { PosterDashboard, TraderOrderbook, WorkerCard } from './Artifacts'
import { cn } from '@/lib/cn'

interface Props {
  audience: Audience
}

const ACCENT: Record<AudienceAccent, string> = {
  success: 'var(--success)',
  brand:   'var(--brand)',
  accent:  'var(--accent)',
}

const ARTIFACTS: Record<AudienceArtifact, () => React.JSX.Element> = {
  'worker-card':       WorkerCard,
  'poster-dashboard':  PosterDashboard,
  'trader-orderbook':  TraderOrderbook,
}

export function AudienceColumn({ audience }: Props) {
  const accent = ACCENT[audience.accent]
  const Artifact = ARTIFACTS[audience.artifact]

  return (
    <article className="group relative flex flex-col gap-5 px-6 pt-8 pb-7 lg:px-8">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-[0.18] transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: accent }}
      />

      <p className="caption uppercase tracking-[0.16em]" style={{ color: accent }}>
        {audience.num} · {audience.tag}
      </p>

      <p className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
        {audience.eyebrow}
      </p>

      <h3 className="h3 text-[var(--content-primary)]">
        {audience.headline.lead}{' '}
        <span style={{ color: accent }}>{audience.headline.emphasis}</span>
      </h3>

      <p className="body text-[var(--content-secondary)]">{audience.body}</p>

      <Artifact />

      <KpiRow kpis={audience.kpis} />

      {audience.callout && <Callout callout={audience.callout} accent={accent} />}

      <a
        href={audience.cta.href}
        className="mt-auto inline-flex items-center gap-1.5 self-start text-sm font-semibold transition-colors hover:opacity-80"
        style={{ color: accent }}
      >
        {audience.cta.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </article>
  )
}

function useResolveLive() {
  const { posterFeePct, seekerFeePct } = useFeePercents()
  return (raw: string): string => {
    if (raw === 'fromLive:posterFeePct') return posterFeePct != null ? `${posterFeePct}%` : '—'
    if (raw === 'fromLive:seekerFeePct') return seekerFeePct != null ? `${seekerFeePct}%` : '—'
    return raw
  }
}

function KpiRow({ kpis }: { kpis: readonly AudienceKpi[] }) {
  const resolve = useResolveLive()

  return (
    <div className={cn('grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-5')}>
      {kpis.map((k) => (
        <div key={k.label} className="flex flex-col gap-1">
          <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
            {k.label}
          </span>
          <span className="mono font-semibold text-[var(--content-primary)]">
            {resolve(k.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Callout({
  callout,
  accent,
}: {
  callout: NonNullable<Audience['callout']>
  accent: string
}) {
  const resolve = useResolveLive()
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5"
      style={{
        background: `color-mix(in oklab, ${accent} 8%, transparent)`,
        borderColor: `color-mix(in oklab, ${accent} 24%, transparent)`,
      }}
    >
      <Smartphone className="h-4 w-4 shrink-0" style={{ color: accent }} />
      <p className="body-sm text-[var(--content-secondary)]">
        {callout.prefix}{' '}
        <span className="mono font-semibold" style={{ color: accent }}>
          {resolve(callout.value)}
        </span>
        {callout.suffix && <span> {callout.suffix}</span>}
      </p>
    </div>
  )
}
