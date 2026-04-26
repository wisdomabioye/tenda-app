import { Info } from 'lucide-react'
import { SectionShell } from '@/components/ui/SectionShell'
import { LiveDot } from '@/components/ui/LiveDot'
import { APP_INFO } from '@/app-info'
import { TICKER_HEADER, TICKER_SAMPLE_NOTICE } from './content'
import { FeedShell } from './FeedShell'
import { AggregateStrip } from './AggregateStrip'

/**
 * §05 Live ticker — explorer-style feed of recent on-chain events on the dark
 * spine, with a 24h aggregate strip below. Every numeric is **sample data**
 * (M75/M76/M94 track the public endpoints). The sample notice banner makes
 * this explicit so visitors aren't misled.
 */
export function LiveTicker() {
  return (
    <SectionShell id="ticker" tone="dark" padY="lg">
      <Header />
      <SampleNotice />
      <div className="mt-8">
        <FeedShell />
      </div>
      <AggregateStrip />
    </SectionShell>
  )
}

function Header() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <div>
        <p className="eyebrow inline-flex flex-wrap items-center gap-2 text-[var(--content-tertiary)]">
          <span className="mono font-bold text-[var(--content-secondary)]">{TICKER_HEADER.eyebrow.num}</span>
          <span className="opacity-60">·</span>
          <span>{TICKER_HEADER.eyebrow.label}</span>
          <span className="caption inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--success)_12%,transparent)] px-2 py-0.5 uppercase tracking-[0.16em] text-[var(--success)]">
            <LiveDot size={5} pulseMs={1600} />
            {TICKER_HEADER.eyebrow.live}
          </span>
        </p>
        <h2 className="h1 mt-4 text-[var(--content-primary)]">
          {TICKER_HEADER.h2.lead}{' '}
          <span className="text-[var(--content-tertiary)]">{TICKER_HEADER.h2.dim}</span>
        </h2>
        <p className="body-lg mt-4 max-w-[58ch] text-[var(--content-secondary)]">
          {TICKER_HEADER.sub}
        </p>
      </div>

      <MetaRows />
    </div>
  )
}

function MetaRows() {
  const resolve = (raw: string): string => {
    if (raw === 'fromAppInfo:programIdShort') return APP_INFO.chain.programIdShort
    if (raw === 'fromAppInfo:network · ~400ms blocks') return `${APP_INFO.chain.network} · ~400ms blocks`
    return raw
  }

  return (
    <div className="flex flex-col divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      {TICKER_HEADER.meta.map((row) => (
        <div key={row.k} className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
            {row.k}
          </span>
          <span className="mono-sm font-semibold text-[var(--content-primary)]">
            {resolve(row.v)}
          </span>
        </div>
      ))}
    </div>
  )
}

function SampleNotice() {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-surface)] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
      <p className="body-sm text-[var(--content-secondary)]">
        <span className="font-semibold text-[var(--content-primary)]">Sample feed.</span>{' '}
        {TICKER_SAMPLE_NOTICE}
      </p>
    </div>
  )
}
