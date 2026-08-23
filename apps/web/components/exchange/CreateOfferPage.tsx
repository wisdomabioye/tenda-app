'use client'

/**
 * Post a P2P sell offer — web port of mobile's OfferSellTab: asset (only
 * chains with a verified linked wallet), amount, your rate, payout
 * account, accept + payment windows. Validation rides the shared
 * offer-form rules; submission rides useOfferSell (draft → terms → sign).
 */
import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  EXCHANGE_PAYMENT_WINDOW_OPTIONS,
  formatFiat,
  parseUnits,
  payoutCurrencyForCountry,
  getOfferMissingRequirement,
} from '@tenda/shared'
import { useExchangeAssetOptions, type ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'
import { useOfferSell } from '@/hooks/exchange/useOfferSell'
import { usePayoutAccounts } from '@/hooks/fiat/usePayoutAccounts'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/auth.store'
import { EmptyPanel, EMPTY_ACTION_CLASS } from '@/components/ui/EmptyPanel'
import { ArrowLeftRight, Clock3, Landmark, Plus, WalletCards } from 'lucide-react'
import { PayoutAccountForm } from '@/components/payout/PayoutAccountForm'

const ACCEPT_HOURS_OPTIONS = [6, 12, 24, 48] as const

export default function CreateOfferPage() {
  const advancedModeEnabled = useAuthStore((state) => state.user?.advanced_mode_enabled === true)
  if (!advancedModeEnabled) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 py-16">
        <EmptyPanel
          icon={<ArrowLeftRight size={28} />}
          title="Offer creation is locked"
          body="Enable P2P Exchange in Settings before creating an offer."
          action={<Link href="/settings" className={EMPTY_ACTION_CLASS}>Open Settings</Link>}
        />
      </div>
    )
  }

  return <CreateOfferComposer />
}

function CreateOfferComposer() {
  const options = useExchangeAssetOptions()
  const [optionKey, setOptionKey] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const { accounts, selected: account, selectedId: accountId, setSelectedId: setAccountId, reload } = usePayoutAccounts()
  const [addingAccount, setAddingAccount] = useState(false)
  const [acceptHours, setAcceptHours] = useState<number>(24)
  const [paymentWindowSeconds, setPaymentWindowSeconds] = useState<number>(
    EXCHANGE_PAYMENT_WINDOW_OPTIONS[0].seconds,
  )
  const { submit, submitting } = useOfferSell()

  const option: ExchangeAssetOption | null =
    options.find((o) => `${o.chainId}:${o.assetId}` === optionKey) ?? options[0] ?? null
  const currency = payoutCurrencyForCountry(account?.country ?? null)

  const amountRaw = useMemo(
    () => (option !== null ? parseUnits(amount, option.decimals) : null),
    [amount, option],
  )
  const rateNum = Number(rate.replace(/,/g, ''))
  const amountNum = Number(amount.replace(/,/g, ''))
  const fiatTotal = Math.round(amountNum * rateNum * 100) / 100

  const missing = getOfferMissingRequirement({
    hasAsset: option !== null,
    amountRaw,
    rate: rateNum,
    fiatTotal,
    hasPayoutAccount: account !== null,
  })

  async function handleSubmit() {
    if (missing !== null || option === null || account === null || amountRaw === null) return
    await submit({
      option,
      amountRaw,
      account,
      fiatTotal,
      currency,
      rate: rateNum,
      acceptHours,
      paymentWindowSeconds,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8">
      <header className="rounded-card border border-border-subtle bg-gradient-to-br from-brand-primary-surface to-surface-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-primary">P2P exchange</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-content-primary">Post a sell offer</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Set clear terms, choose where you get paid, then secure the asset in escrow.</p>
      </header>

      <ComposerSection icon={<WalletCards size={18} />} title="Asset and price" description="Choose a linked asset and set the buyer's total.">
        <h2 className="text-sm font-semibold text-content-primary">Asset</h2>
        {options.length === 0 ? (
          <p className="text-sm text-content-secondary">
            Link a wallet first —{' '}
            <Link href="/settings/linked-wallets" className="font-semibold text-brand-primary hover:underline">
              Linked wallets
            </Link>
            . Only chains with a verified wallet can sell.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => (
              <Chip
                key={`${o.chainId}:${o.assetId}`}
                label={`${o.symbol} · ${o.chainName}`}
                selected={option !== null && `${option.chainId}:${option.assetId}` === `${o.chainId}:${o.assetId}`}
                onClick={() => setOptionKey(`${o.chainId}:${o.assetId}`)}
              />
            ))}
          </div>
        )}
      <label className="mt-2 flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-content-primary">Amount to sell</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="rounded-control border border-border-default bg-surface-card p-3 font-numeric text-content-primary outline-none focus:border-brand-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-content-primary">
          Your rate ({currency} per {option?.symbol ?? 'unit'})
        </span>
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="rounded-control border border-border-default bg-surface-card p-3 font-numeric text-content-primary outline-none focus:border-brand-primary"
        />
        {fiatTotal > 0 && (
          <span className="font-numeric text-xs text-content-secondary">
            Buyer pays {formatFiat(fiatTotal, currency)}
          </span>
        )}
      </label>
      </ComposerSection>

      <ComposerSection icon={<Landmark size={18} />} title="Payout account" description="The buyer will send fiat to this destination.">
        {accounts === null ? (
          <p className="text-sm text-content-tertiary">Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-content-secondary">No payout account yet. Add one below to continue.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {accounts.map((row) => (
              <button
                key={row.id}
                type="button"
                aria-pressed={accountId === row.id}
                onClick={() => setAccountId(row.id)}
                className={cn(
                  'rounded-card border px-4 py-2.5 text-left text-sm transition-colors',
                  accountId === row.id
                    ? 'border-brand-primary bg-brand-primary-surface'
                    : 'border-border-subtle bg-surface-card hover:bg-surface-inset',
                )}
              >
                <span className="block font-semibold text-content-primary">{row.account_name}</span>
                <span className="font-numeric text-xs text-content-secondary">
                  {row.bank_code} · {row.account_number_masked}
                </span>
              </button>
            ))}
          </div>
        )}
        <button type="button" aria-expanded={addingAccount} onClick={() => setAddingAccount((open) => !open)} className="mt-2 inline-flex items-center gap-2 self-start text-sm font-semibold text-brand-primary hover:underline">
          <Plus size={15} aria-hidden /> {addingAccount ? 'Close account form' : 'Add another account'}
        </button>
        {addingAccount && (
          <PayoutAccountForm
            description="Create and select a payout destination without losing your offer."
            onCreated={(row) => {
              setAccountId(row.id)
              reload()
              setAddingAccount(false)
            }}
          />
        )}
      </ComposerSection>

      <ComposerSection icon={<Clock3 size={18} />} title="Timing" description="Control how long buyers have to accept and pay.">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-content-primary">Offer open for</h2>
        <div className="flex flex-wrap gap-1.5">
          {ACCEPT_HOURS_OPTIONS.map((h) => (
            <Chip key={h} label={`${h}h`} selected={acceptHours === h} onClick={() => setAcceptHours(h)} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-content-primary">Buyer pays within</h2>
        <div className="flex flex-wrap gap-1.5">
          {EXCHANGE_PAYMENT_WINDOW_OPTIONS.map((opt) => (
            <Chip
              key={opt.seconds}
              label={opt.label}
              selected={paymentWindowSeconds === opt.seconds}
              onClick={() => setPaymentWindowSeconds(opt.seconds)}
            />
          ))}
        </div>
      </section>
      </ComposerSection>

      <Button fullWidth disabled={missing !== null || submitting} onClick={() => void handleSubmit()}>
        {submitting ? 'Submitting…' : (missing ?? 'Post offer')}
      </Button>
    </div>
  )
}

function ComposerSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-primary-surface text-brand-primary">{icon}</span>
        <span><h2 className="font-display text-lg font-semibold text-content-primary">{title}</h2><p className="mt-0.5 text-sm text-content-secondary">{description}</p></span>
      </div>
      {children}
    </section>
  )
}
