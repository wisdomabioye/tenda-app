import { chainStatus, LANDING_CHAINS, MORE_CHAINS_LABEL } from '@/content'
import { cn } from '@/lib/cn'

interface Props {
  /** Append the "more coming" badge. */
  withMore?: boolean
  className?: string
}

/**
 * The supported-chain badge row (manifest-derived): one dot-tinted pill per
 * mainnet chain, optionally followed by a "more coming" badge. Used in the
 * hero and the final CTA.
 *
 * A PLANNED chain is drawn in the dashed, untinted treatment this row already
 * used for "more coming", because that is what it is — a chain Tenda intends to
 * settle on, not one it does. Rendering all four identically is what let the
 * hero imply four live deployments; the row still shows every chain, it just
 * stops claiming they are equivalent.
 */
export function ChainBadges({ withMore = true, className }: Props) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {LANDING_CHAINS.map((chain) => {
        const live = chainStatus(chain) === 'live'
        return (
          <span
            key={chain.id}
            className={cn(
              'mono-sm inline-flex h-8 items-center gap-2 rounded-full border px-3.5 font-semibold',
              live
                ? 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--content-secondary)]'
                : 'border-dashed border-[var(--border-strong)] text-[var(--content-tertiary)]',
            )}
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={
                live
                  ? {
                      backgroundColor: chain.color,
                      boxShadow: `0 0 0 3px color-mix(in oklab, ${chain.color} 22%, transparent)`,
                    }
                  : // Hollow, not tinted: the brand dot is the row's "this is
                    // running" signal and a planned chain has not earned it.
                    { border: `1px solid ${chain.color}` }
              }
            />
            {chain.name}
          </span>
        )
      })}
      {withMore && (
        <span className="mono-sm inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-[var(--border-strong)] px-3.5 text-[var(--content-tertiary)]">
          {MORE_CHAINS_LABEL}
        </span>
      )}
    </div>
  )
}
