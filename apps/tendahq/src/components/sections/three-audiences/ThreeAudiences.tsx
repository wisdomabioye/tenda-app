import { SectionShell } from '@/components/ui/SectionShell'
import { AUDIENCES, AUDIENCES_HEADER, type AudienceAccent } from './content'
import { AudienceColumn } from './AudienceColumn'
import { cn } from '@/lib/cn'

const TAB_TONE: Record<AudienceAccent, string> = {
  success: 'var(--success)',
  brand:   'var(--brand)',
  accent:  'var(--accent)',
}

/**
 * §08 Three audiences — light interlude after the dark §07. Three columns
 * (Workers / Posters / Traders) anchored by native UI artifacts. Hairline
 * dividers between columns; each carries its own accent.
 *
 * Pre-launch honesty: every KPI is either a Solana fact (settlement),
 * an escrow guarantee (refund-if-unshipped), or a live API value
 * (worker / poster fee from /v1/platform/config). No placeholders ship here.
 */
export function ThreeAudiences() {
  return (
    <SectionShell id="for-who" tone="light" padY="lg">
      <Header />

      <div className="mt-10 flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <Tab key={a.num} tag={a.tag} suffix={a.tabSuffix} accent={a.accent} />
        ))}
      </div>

      <div
        className={cn(
          'mt-6 grid divide-y divide-[var(--border-subtle)] overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)]',
          'lg:grid-cols-3 lg:divide-x lg:divide-y-0',
        )}
      >
        {AUDIENCES.map((audience) => (
          <AudienceColumn key={audience.num} audience={audience} />
        ))}
      </div>
    </SectionShell>
  )
}

function Header() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <div>
        <p className="eyebrow text-[var(--content-tertiary)]">
          <span className="mono font-semibold text-[var(--brand)]">
            {AUDIENCES_HEADER.eyebrow.num}
          </span>
          <span className="mx-2 opacity-60">·</span>
          {AUDIENCES_HEADER.eyebrow.label}
        </p>
        <h2 className="h1 mt-4 text-[var(--content-primary)]">
          {AUDIENCES_HEADER.h2.line1}
          <br />
          <span className="text-[var(--content-tertiary)]">{AUDIENCES_HEADER.h2.dim}</span>
        </h2>
      </div>
      <p className="body-lg text-[var(--content-secondary)] lg:mt-2">
        {AUDIENCES_HEADER.sub}
      </p>
    </div>
  )
}

function Tab({ tag, suffix, accent }: { tag: string; suffix: string; accent: AudienceAccent }) {
  const tone = TAB_TONE[accent]
  return (
    <span
      className="caption inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-1.5 uppercase tracking-[0.12em] text-[var(--content-secondary)]"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: tone,
          boxShadow: `0 0 0 3px color-mix(in oklab, ${tone} 22%, transparent)`,
        }}
      />
      <span className="font-semibold text-[var(--content-primary)]">{tag}</span>
      <span className="text-[var(--content-tertiary)]">· {suffix}</span>
    </span>
  )
}
