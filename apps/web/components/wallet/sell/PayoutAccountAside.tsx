'use client'

/**
 * Where the money lands (Tier-3 comp, lines 759-775).
 *
 * The comp offers a choice of RAILS — bank, card, mobile money — as if the
 * reader picks a transfer method. They do not: a payout account IS its rail
 * (`BankAccountSummary.kind`), chosen when the account was added and fixed by
 * the country's payout spec. So the aside lists the accounts they actually
 * have, and the rail is a fact printed on each rather than a control.
 *
 * The account is also what decides the payout CURRENCY, which is why an empty
 * list is a hard stop rather than a nicety: there is no "default" destination
 * to fall back to, and inventing one would send someone's money somewhere they
 * did not choose.
 */
import Link from 'next/link'
import { CURRENCY_META, getPayoutRail, payoutCurrencyForCountry } from '@tenda/shared'
import type { BankAccountSummary } from '@tenda/shared'
import { EmptyPanel, EMPTY_ACTION_CLASS } from '@/components/ui/EmptyPanel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { cn } from '@/lib/cn'
import type { PayoutAccountsState } from '@/hooks/fiat/usePayoutAccounts'
import { SELL_COPY } from './copy'

/** The rail's own name where the country spec has one, else the raw kind. */
function railName(account: BankAccountSummary): string {
  return getPayoutRail(account.country, account.kind)?.label ?? account.kind
}

export function PayoutAccountAside({ payout }: { payout: PayoutAccountsState }) {
  const { accounts } = payout

  return (
    <aside className="rounded-card border border-border-subtle bg-surface-inset p-4.5">
      <Eyebrow as="h2">{SELL_COPY.railLabel}</Eyebrow>

      {accounts === null ? (
        // Still loading. NOT the empty state: "add a payout account" to someone
        // who has three would be a lie with a button on it.
        <div aria-hidden className="mt-3 flex animate-shimmer flex-col gap-2">
          <div className="h-14 rounded-control bg-surface-card" />
          <div className="h-14 rounded-control bg-surface-card" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="mt-3">
          <EmptyPanel
            title={SELL_COPY.noPayout}
            body="Your cash-out needs a destination before it can be quoted."
            action={
              <Link href="/settings/payout-accounts" className={EMPTY_ACTION_CLASS}>
                {SELL_COPY.noPayoutAction}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2" role="group" aria-label={SELL_COPY.railLabel}>
          {accounts.map((account) => {
            const selected = account.id === payout.selectedId
            const currency = payoutCurrencyForCountry(account.country)
            return (
              <button
                key={account.id}
                type="button"
                aria-pressed={selected}
                onClick={() => payout.setSelectedId(account.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-control border px-3.5 py-3 text-left transition-colors duration-(--motion-fast)',
                  selected
                    ? 'border-control-selected-border bg-control-selected-background'
                    : 'border-border-default bg-surface-card hover:border-border-strong',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-content-primary">
                    {account.account_name}
                  </span>
                  <span className="mt-0.5 block truncate font-numeric text-xs text-content-tertiary">
                    {railName(account)} · {account.account_number_masked}
                  </span>
                </span>
                <span className="shrink-0 font-numeric text-xs font-bold text-content-secondary">
                  {CURRENCY_META[currency].symbol} {currency}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-3.5 text-xs leading-4 text-content-tertiary">{SELL_COPY.railNote}</p>
    </aside>
  )
}
