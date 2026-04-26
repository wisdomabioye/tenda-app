import { ExternalLink } from 'lucide-react'
import { LiveDot } from '@/components/ui/LiveDot'
import { Placeholder } from '@/components/ui/Placeholder'
import { MarqueeRow } from '@/components/ui/MarqueeRow'
import { APP_INFO } from '@/app-info'
import { MOCK_PROOF_FEED } from '@/data/mock-feed'
import { TRUST_LABELS, TRUST_PLACEHOLDERS } from './content'
import { ProofRow } from './ProofRow'

/**
 * §02 Trust strip — live proof band sitting on the dark spine. Three zones:
 *   LEFT   identity badge + escrow account name + chain caption
 *   CENTER running settlement marquee, edge-masked, slow drift
 *   RIGHT  program id + slot + Explorer link
 *
 * Per IMPLEMENTATION.md §3.4 this is dark-themed regardless of user mode.
 */
export function TrustStrip() {
  return (
    <section
      id="trust"
      data-theme="dark"
      className="relative isolate w-full bg-[var(--surface-bg)] text-[var(--content-primary)]"
      style={{
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 200% at 50% 50%, color-mix(in oklab, var(--live-bright) 6%, transparent), transparent 70%)',
        }}
      />

      {/* Desktop layout */}
      <div className="relative z-10 hidden items-center gap-12 px-20 py-7 lg:grid lg:grid-cols-[auto_1fr_auto]">
        <Identity />
        <FeedMarquee />
        <ChainMeta />
      </div>

      {/* Mobile layout */}
      <div className="relative z-10 flex w-full max-w-full flex-col gap-3 overflow-hidden px-5 py-5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <IdentityBadge />
          <span className="mono-sm shrink-0 uppercase text-[var(--content-tertiary)]">
            {TRUST_LABELS.slotLabel}{' '}
            <Placeholder issue={TRUST_PLACEHOLDERS.slot.issue}>{TRUST_PLACEHOLDERS.slot.value}</Placeholder>
          </span>
        </div>
        <div className="flex w-full flex-col gap-1.5 overflow-hidden">
          {MOCK_PROOF_FEED.slice(0, 3).map((row) => (
            <ProofRow key={row.id} row={row} compact className="w-full" />
          ))}
        </div>
        <div className="mono-sm flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[var(--content-tertiary)]">
          <span>
            {TRUST_LABELS.chainLabel.toUpperCase()}{' '}
            <span className="text-[var(--content-primary)]">{APP_INFO.chain.network}</span>
          </span>
          <span>
            {TRUST_LABELS.programLabel.toUpperCase()}{' '}
            <span className="text-[var(--content-primary)]">{APP_INFO.chain.programIdShort}</span>
          </span>
          <a
            href={APP_INFO.chain.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[var(--brand)] hover:underline"
          >
            {TRUST_LABELS.verifyValue}
          </a>
        </div>
      </div>
    </section>
  )
}

function Identity() {
  return (
    <div className="flex items-center gap-3.5">
      <IdentityBadge />
      <div>
        <p className="h3 text-[var(--content-primary)]">{TRUST_LABELS.identityName}</p>
        <p className="mono-sm uppercase text-[var(--content-tertiary)]">
          {APP_INFO.chain.network} · {APP_INFO.version.replace(/^v/, 'v')}
        </p>
      </div>
    </div>
  )
}

function IdentityBadge() {
  return (
    <span
      className="mono-sm inline-flex h-7 items-center gap-2 rounded-md border px-2.5 font-semibold uppercase tracking-[0.16em]"
      style={{
        background: 'color-mix(in oklab, var(--live-bright) 10%, transparent)',
        borderColor: 'color-mix(in oklab, var(--live-bright) 22%, transparent)',
        color: 'var(--live-bright)',
      }}
    >
      <LiveDot size={6} pulseMs={1600} />
      {TRUST_LABELS.badge}
    </span>
  )
}

function FeedMarquee() {
  return (
    <div className="h-9 overflow-hidden">
      <MarqueeRow
        items={MOCK_PROOF_FEED}
        keyOf={(r) => r.id}
        renderItem={(row) => <ProofRow row={row} />}
        speedSec={48}
        edgeFade
        pauseOnHover
        itemClassName="px-4"
        className="h-full"
      />
    </div>
  )
}

function ChainMeta() {
  return (
    <div className="flex items-center gap-7">
      <Cell label={TRUST_LABELS.programLabel}>
        <span className="text-[var(--content-primary)]">
          {APP_INFO.chain.programIdShort.split('…')[0]}
          …
          <span className="text-[var(--success)]">
            {APP_INFO.chain.programIdShort.split('…')[1]}
          </span>
        </span>
      </Cell>
      <Cell label={TRUST_LABELS.slotLabel}>
        <Placeholder issue={TRUST_PLACEHOLDERS.slot.issue}>
          {TRUST_PLACEHOLDERS.slot.value}
        </Placeholder>
      </Cell>
      <a
        href={APP_INFO.chain.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="mono-sm inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-transparent px-3 font-semibold uppercase tracking-[0.12em] text-[var(--content-primary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--brand)]"
      >
        <ExternalLink className="h-3 w-3" />
        {TRUST_LABELS.explorer}
      </a>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono-sm uppercase tracking-[0.16em] text-[var(--content-tertiary)] text-[9.5px]">
        {label}
      </span>
      <span className="mono text-[13px] font-semibold">{children}</span>
    </div>
  )
}
