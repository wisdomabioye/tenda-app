import { ExternalLink } from 'lucide-react'
import { explorerHost, transportFor, type LandingChain } from '@/content'
import { CopyChainId } from './CopyChainId'
import { NETWORK_LABELS } from './content'

interface Props {
  chain: LandingChain
}

/** One label/value line. Rendered as a definition list so it reads as data. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border-default)] py-2.5">
      <dt className="caption font-bold uppercase tracking-[0.06em] text-[var(--content-tertiary)]">
        {label}
      </dt>
      <dd className="mono-sm min-w-0 truncate text-right text-[var(--content-primary)]">
        {children}
      </dd>
    </div>
  )
}

/**
 * One supported chain, as reference data rather than a pitch.
 *
 * Every value comes from the shared manifest by way of content/chains.ts. The
 * two facts that can legitimately be absent are handled rather than assumed:
 * a namespace with no adapter yields an empty transport, and a chain with no
 * `explorerUrl` yields no link — both rows are omitted instead of rendering a
 * label above a blank, which is what a `?? '—'` fallback would do while
 * looking deliberate.
 */
export function NetworkCard({ chain }: Props) {
  const transport = transportFor(chain.namespace)

  return (
    <article className="flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        {/*
          `color-mix`, not `${chain.color}1a`. The concatenation assumed the
          colour is always a hex literal, but `displayFor` documents — and
          chains.test.ts asserts — that a family with no marketing row falls
          back to `var(--brand)`, which would have produced the invalid
          declaration `var(--brand)1a` and silently dropped the tint on exactly
          the manifest-first path this codebase is built to support. The sibling
          EcosystemPanel already solves it this way.
        */}
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-lg text-base"
          style={{
            backgroundColor: `color-mix(in oklab, ${chain.color} 12%, transparent)`,
            color: chain.color,
          }}
        >
          {chain.glyph}
        </span>
        <h3 className="body-lg font-semibold text-[var(--content-primary)]">{chain.name}</h3>
      </div>

      {chain.pitch !== '' && (
        <p className="body-sm mt-3 text-[var(--content-secondary)]">{chain.pitch}</p>
      )}

      <dl className="mt-4 flex flex-col">
        <Fact label={NETWORK_LABELS.chainId}>
          <span className="inline-flex items-center gap-1">
            {chain.id}
            <CopyChainId chainId={chain.id} />
          </span>
        </Fact>
        <Fact label={NETWORK_LABELS.gasToken}>{chain.nativeSymbol}</Fact>
        {transport !== '' && <Fact label={NETWORK_LABELS.transport}>{transport}</Fact>}
        {chain.explorerUrl !== undefined && (
          <Fact label={NETWORK_LABELS.explorer}>
            <a
              href={chain.explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline"
            >
              {explorerHost(chain.explorerUrl)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Fact>
        )}
      </dl>
    </article>
  )
}
