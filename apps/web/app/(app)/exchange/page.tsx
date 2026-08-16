'use client'

/**
 * P2P exchange — web port of mobile's Trade tab: Market | My Trades,
 * currency filter, behind the CO4 advanced-mode gate (the settings toggle
 * unlocks it; exchange is NEVER public — both endpoints require auth).
 * There is no Buy tab: onramp was retired (#61).
 */
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { CURRENCY_META, PAYOUT_CURRENCIES, type EscrowListRow } from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'
import { useExchangeScreen } from '@/hooks/exchange/useExchangeScreen'
import { ExchangeOfferCard } from '@/components/exchange'
import { ExchangeStatusBadge } from '@/components/escrow/StatusBadge'
import { ChainFilterChips } from '@/components/shared/ChainFilterChips'
import { PaginatedList } from '@/components/shared/PaginatedList'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

function MyTradeRow({ row, userId }: { row: EscrowListRow; userId: string }) {
  const selling = row.creator_id === userId
  return (
    <Link
      href={`/exchange/${row.id}`}
      className="flex items-center gap-2 rounded-card border border-border-subtle bg-surface-card px-4 py-3 transition-colors hover:bg-surface-inset"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-content-primary">{row.title}</span>
        <span className="text-xs text-content-tertiary">{selling ? 'Selling' : 'Buying'}</span>
      </span>
      <ExchangeStatusBadge status={row.status} />
    </Link>
  )
}

export default function ExchangePage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const { market, myTrades, currency, chainId, setCurrency, setChainId } = useExchangeScreen()
  const [tab, setTab] = useState<'market' | 'mine'>('market')

  if (user !== null && !user.advanced_mode_enabled) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-8 py-24 text-center">
        <ArrowLeftRight size={36} className="text-content-secondary" />
        <p className="font-semibold text-content-primary">P2P Exchange is locked</p>
        <p className="text-sm text-content-secondary">
          Turn on P2P Exchange in Settings to browse the order book and post sell offers.
        </p>
        <Link href="/settings">
          <Button variant="outline">Open Settings</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between px-1 pb-3 pt-6">
        <h1 className="font-display text-2xl font-bold text-content-primary">Trade</h1>
        <Link href="/exchange/new">
          <Button variant="outline">
            <Plus size={15} /> Post offer
          </Button>
        </Link>
      </div>

      <div className="flex border-b border-border-subtle" role="tablist" aria-label="Exchange lists">
        {(
          [
            { key: 'market', label: 'Market', total: null },
            { key: 'mine', label: 'My Trades', total: myTrades.hasFetched ? myTrades.total : null },
          ] as const
        ).map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-solid text-content-primary'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary',
              )}
            >
              {t.label}
              {t.total !== null && (
                <span className="rounded-full bg-surface-inset px-1.5 font-numeric text-[11px] text-content-secondary">
                  {t.total}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ONE control for the screen (mobile structure): chainId filters BOTH
          the market and My Trades. */}
      <ChainFilterChips value={chainId} onChange={setChainId} />

      {tab === 'market' && (
        <div className="flex flex-wrap gap-1.5 py-3" role="group" aria-label="Currency filter">
          {PAYOUT_CURRENCIES.map((cur) => (
            <button
              key={cur}
              type="button"
              aria-pressed={currency === cur}
              onClick={() => setCurrency(currency === cur ? null : cur)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                currency === cur
                  ? 'border-brand-primary bg-brand-primary-surface text-brand-primary'
                  : 'border-border-subtle text-content-secondary hover:bg-surface-inset',
              )}
            >
              {CURRENCY_META[cur].symbol} {cur}
            </button>
          ))}
        </div>
      )}

      <div className="pt-1">
        {tab === 'market' ? (
          <PaginatedList
            list={market}
            keyOf={(offer) => offer.escrow_id}
            renderItem={(offer) => <ExchangeOfferCard offer={offer} />}
            errorTitle="Could not load the order book"
            empty={
              <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
                <ArrowLeftRight size={36} className="text-content-secondary" />
                <p className="font-semibold text-content-primary">No open offers</p>
                <p className="text-sm text-content-secondary">
                  {currency !== null ? 'Try clearing the currency filter.' : 'Check back soon, or post your own offer.'}
                </p>
              </div>
            }
          />
        ) : (
          <div className="pt-3">
            <PaginatedList
              list={myTrades}
              keyOf={(row) => row.id}
              renderItem={(row) => <MyTradeRow row={row} userId={userId} />}
              errorTitle="Could not load your trades"
              empty={
                <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
                  <p className="font-semibold text-content-primary">No trades yet</p>
                  <p className="text-sm text-content-secondary">Offers you post or accept appear here.</p>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
