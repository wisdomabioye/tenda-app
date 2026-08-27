import { useState } from 'react'
import { Bot, Fuel, Sparkles, Wallet, Zap } from 'lucide-react'
import { SectionShell } from '@/components/ui/SectionShell'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Pill } from '@/components/ui/Pill'
import { LiveDot } from '@/components/ui/LiveDot'
import { useIntersect } from '@/hooks/useIntersect'
import { ONBOARDING_FEATURES, ONBOARDING_HEADER } from '@/content'
import { cn } from '@/lib/cn'

const ICONS = { Bot, Fuel, Sparkles, Wallet, Zap } as const

/**
 * §05 Onboarding rails — a SELECTOR RAIL over ONE detail panel. Five rails
 * as a grid tiled badly at every width (too fat at three-up, too narrow at
 * five-up, too tall as ledger rows — all three shipped and were rejected),
 * so only the selected rail's prose exists on screen: a compact row of pill
 * tabs, then a single panel that swaps content. Proper tablist semantics;
 * the initial markup carries exactly one panel (the default rail) and the
 * rest is a click away — a trade a marketing section can afford where a
 * docs page could not.
 *
 * Roadmap tabs carry a muted dot so the honest live/roadmap split survives
 * the compression; the panel repeats it as the full status pill.
 */
export function Onboarding() {
  const { ref, isVisible } = useIntersect<HTMLDivElement>({ threshold: 0.15 })
  const [selectedId, setSelectedId] = useState(ONBOARDING_FEATURES[0]?.id)
  const selected =
    ONBOARDING_FEATURES.find((f) => f.id === selectedId) ?? ONBOARDING_FEATURES[0]
  const Icon = ICONS[selected.icon]

  return (
    <SectionShell id="onboarding" surface="base" padY="lg">
      <div className="mb-12 flex max-w-[62ch] flex-col gap-4">
        <Eyebrow tone="brand" dot>
          {ONBOARDING_HEADER.eyebrow}
        </Eyebrow>
        <h2 className="h1 text-[var(--content-primary)]">
          {ONBOARDING_HEADER.h2.lead}{' '}
          <span className="text-[var(--brand)]">{ONBOARDING_HEADER.h2.emphasis}</span>
        </h2>
        <p className="body-lg text-[var(--content-secondary)]">{ONBOARDING_HEADER.sub}</p>
      </div>

      <div ref={ref} data-visible={isVisible || undefined} className="reveal-on-scroll">
        <div
          role="tablist"
          aria-label="Onboarding rails"
          className="mb-4 flex flex-wrap gap-2"
        >
          {ONBOARDING_FEATURES.map((feature) => {
            const TabIcon = ICONS[feature.icon]
            const active = feature.id === selected.id
            return (
              <button
                key={feature.id}
                type="button"
                role="tab"
                id={`onboarding-tab-${feature.id}`}
                aria-selected={active}
                aria-controls="onboarding-panel"
                onClick={() => setSelectedId(feature.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--brand)] bg-[var(--brand-surface)] text-[var(--brand)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--content-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--content-primary)]',
                )}
              >
                <TabIcon className="h-4 w-4" />
                {feature.tab}
                {feature.status !== 'live' && (
                  <span
                    aria-hidden
                    title="On the roadmap"
                    className="h-1.5 w-1.5 rounded-full bg-[var(--content-tertiary)]"
                  />
                )}
              </button>
            )
          })}
        </div>

        <article
          role="tabpanel"
          id="onboarding-panel"
          aria-labelledby={`onboarding-tab-${selected.id}`}
          className="grid gap-x-8 gap-y-4 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-7 shadow-[var(--shadow-card)] md:min-h-[13rem] md:grid-cols-[auto_1fr_auto] md:p-8"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-surface)] text-[var(--brand)]">
            <Icon className="h-6 w-6" />
          </span>

          <div className="flex min-w-0 flex-col gap-2">
            {selected.chains.length > 0 && (
              <span className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--content-tertiary)]">
                {selected.chains.map((chain) => (
                  <span key={chain.id} className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: chain.color }}
                    />
                    {chain.name}
                  </span>
                ))}
              </span>
            )}
            <h3 className="h3 text-[var(--content-primary)]">{selected.title}</h3>
            <p className="body max-w-[58ch] text-[var(--content-secondary)]">{selected.body}</p>
            <p className="mono-sm mt-2 text-[var(--content-tertiary)]">{selected.fact}</p>
          </div>

          <div className="row-start-1 justify-self-end md:col-start-3">
            {selected.status === 'live' ? (
              <Pill tone="live" size="sm">
                <LiveDot size={5} className="mr-1" />
                Live
              </Pill>
            ) : (
              <Pill tone="neutral" size="sm">
                Roadmap
              </Pill>
            )}
          </div>
        </article>
      </div>
    </SectionShell>
  )
}
