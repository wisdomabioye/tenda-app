/**
 * Wallet balance hero + lifetime stats (web port of mobile's WalletHeroCard
 * and EarningsSummary, one file — they always render together here). The
 * USDC-first total across every linked wallet/chain: gigs settle in USDC on
 * all chains, so it's one summable unit. Display-only.
 */

function Amount({ value }: { value: number }) {
  return (
    <span className="font-numeric text-4xl font-bold tracking-tight text-content-primary">
      {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )
}

export function WalletHeroCard({
  totalUsdc,
  earnedUsdc,
  spentUsdc,
  isLoading,
}: {
  totalUsdc: number
  earnedUsdc: number
  spentUsdc: number
  isLoading: boolean
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-card border border-brand-primary-border bg-brand-primary-surface px-6 py-5">
        <p className="font-numeric text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">
          Total balance
        </p>
        <div className="mt-2 flex min-h-11 items-baseline gap-2" aria-busy={isLoading}>
          {isLoading ? (
            <span data-testid="hero-skeleton" className="h-10 w-40 animate-pulse rounded-md bg-surface-inset" />
          ) : (
            <>
              <Amount value={totalUsdc} />
              <span className="font-numeric text-sm text-content-tertiary">USDC</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border-default bg-surface-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Earned</p>
          <p className="font-numeric mt-1 text-lg font-bold text-numeric-positive">+ {earnedUsdc.toFixed(2)}</p>
          <p className="text-xs text-content-tertiary">USDC · lifetime</p>
        </div>
        <div className="rounded-card border border-border-default bg-surface-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Spent</p>
          <p className="font-numeric mt-1 text-lg font-bold text-numeric-negative">− {spentUsdc.toFixed(2)}</p>
          <p className="text-xs text-content-tertiary">USDC · lifetime</p>
        </div>
      </div>
    </section>
  )
}
