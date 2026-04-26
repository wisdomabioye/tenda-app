import { LiveDot } from '@/components/ui/LiveDot'
import { Pill } from '@/components/ui/Pill'
import { CLAUSE_LINES, FALLBACK, type FallbackRoute } from './content'
import { cn } from '@/lib/cn'

/**
 * Fallback subsection — 4 escrow-exit routes on the left and a code clause
 * from the on-chain program on the right. Closes §04 with: funds are never
 * stuck, every path settles deterministically.
 *
 * Mobile-first overflow rules: the outer wrapper and every nested flex/grid
 * track use `min-w-0` + `overflow-hidden` so the inline <pre> can scroll on
 * its own axis without dragging the page wider than the viewport.
 */
export function Fallback() {
  return (
    <div
      className={cn(
        'mt-16 grid gap-10 overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card-elevated)] p-6 sm:p-8',
        'lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:p-10',
      )}
    >
      <div className="min-w-0">
        <span className="caption inline-flex items-center gap-2 uppercase tracking-[0.16em] text-[var(--accent)]">
          <LiveDot size={6} className="opacity-90" />
          {FALLBACK.tag}
        </span>
        <h3 className="h2 mt-3 text-[var(--content-primary)]">{FALLBACK.h3}</h3>
        <p className="body-lg mt-4 text-[var(--content-secondary)]">{FALLBACK.body}</p>

        <ul className="mt-7 flex flex-col gap-2.5">
          {FALLBACK.routes.map((route) => (
            <RouteRow key={route.letter} route={route} />
          ))}
        </ul>
      </div>

      <ClausePanel />
    </div>
  )
}

function RouteRow({ route }: { route: FallbackRoute }) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-x-3.5 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5',
        'sm:flex-nowrap',
        route.aspirational && 'opacity-90',
      )}
    >
      <span className="mono inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-xs font-bold text-[var(--content-secondary)]">
        {route.letter}
      </span>

      <div className="min-w-0 flex-1">
        <p className="body-sm text-[var(--content-secondary)]">
          <span className="font-semibold text-[var(--content-primary)]">{route.prefix}</span>{' '}
          {route.body}
        </p>
      </div>

      {/* Meta cluster — full row beneath the body on mobile (so the body owns
          the full content width), inline on the right at sm+. */}
      <div className="flex w-full items-center justify-start gap-2 pl-11 sm:ml-auto sm:w-auto sm:justify-end sm:pl-0">
        {route.aspirational && (
          <Pill tone="warning" size="sm">
            Planned
          </Pill>
        )}
        <span className="mono-sm whitespace-nowrap text-[var(--content-tertiary)]">
          {route.time}
        </span>
      </div>
    </li>
  )
}

function ClausePanel() {
  return (
    <div className="flex min-w-0 flex-col">
      <p className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
        {FALLBACK.clauseTitle}
      </p>

      <pre
        className="mt-3 max-w-full overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4 text-[12.5px] leading-6 sm:p-5"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {CLAUSE_LINES.map((line, i) => (
          <ClauseLine key={i} line={line} />
        ))}
      </pre>

      <p className="mono-sm mt-4 text-[var(--content-tertiary)]">{FALLBACK.clauseFootnote}</p>
    </div>
  )
}

type ClauseLine = (typeof CLAUSE_LINES)[number]

function ClauseLine({ line }: { line: ClauseLine }) {
  if (line.kind === 'comment') {
    return <div style={{ color: 'var(--content-tertiary)' }}>{line.text}</div>
  }
  if (line.kind === 'open') {
    return (
      <div style={{ color: 'var(--content-primary)' }}>
        <span style={{ color: 'var(--brand)', fontWeight: 600 }}>match</span> gig.status {'{'}
      </div>
    )
  }
  if (line.kind === 'close') {
    return <div style={{ color: 'var(--content-primary)' }}>{line.text}</div>
  }
  return (
    <div className="pl-4">
      <span style={{ color: 'var(--accent)' }}>{line.name}</span>{' '}
      <span style={{ color: 'var(--content-tertiary)' }}>→</span>{' '}
      <span style={{ color: 'var(--content-secondary)' }}>{line.value}</span>
    </div>
  )
}
