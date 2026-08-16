'use client'

/**
 * Post a P2P sell offer — web port of mobile's OfferSellTab: asset (only
 * chains with a verified linked wallet), amount, your rate, payout
 * account, accept + payment windows. Validation rides the shared
 * offer-form rules; submission rides useOfferSell (draft → terms → sign).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  EXCHANGE_PAYMENT_WINDOW_OPTIONS,
  formatFiat,
  parseUnits,
  payoutCurrencyForCountry,
  type BankAccountSummary,
  getOfferMissingRequirement,
} from '@tenda/shared'
import { api } from '@/api/client'
import { useChainRegistryStore } from '@/stores/chain-registry.store'
import { useExchangeAssetOptions, type ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'
import { useOfferSell } from '@/hooks/exchange/useOfferSell'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'

const ACCEPT_HOURS_OPTIONS = [6, 12, 24, 48] as const

export default function NewOfferPage() {
  const loadChains = useChainRegistryStore((s) => s.fetch)
  useEffect(() => {
    void loadChains()
  }, [loadChains])

  const options = useExchangeAssetOptions()
  const [optionKey, setOptionKey] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [acceptHours, setAcceptHours] = useState<number>(24)
  const [paymentWindowSeconds, setPaymentWindowSeconds] = useState<number>(
    EXCHANGE_PAYMENT_WINDOW_OPTIONS[0].seconds,
  )
  const { submit, submitting } = useOfferSell()

  useEffect(() => {
    api.fiat
      .bankAccounts()
      .then((rows) => {
        setAccounts(rows)
        setAccountId((current) => current ?? rows.find((r) => r.is_default)?.id ?? rows[0]?.id ?? null)
      })
      .catch(() => setAccounts([]))
  }, [])

  const option: ExchangeAssetOption | null =
    options.find((o) => `${o.chainId}:${o.assetId}` === optionKey) ?? options[0] ?? null
  const account = accounts?.find((a) => a.id === accountId) ?? null
  const currency = payoutCurrencyForCountry(account?.country ?? null)

  const amountRaw = useMemo(
    () => (option !== null ? parseUnits(amount, option.decimals) : null),
    [amount, option],
  )
  const rateNum = parseFloat(rate.replace(/,/g, '')) || 0
  const amountNum = parseFloat(amount.replace(/,/g, '')) || 0
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="pt-1 font-display text-2xl font-bold text-content-primary">Post a sell offer</h1>

      <section className="flex flex-col gap-2">
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
      </section>

      <label className="flex flex-col gap-1.5 text-sm">
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-content-primary">Payout account</h2>
        {accounts === null ? (
          <p className="text-sm text-content-tertiary">Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-content-secondary">
            Add a payout account first —{' '}
            <Link href="/settings/bank-accounts" className="font-semibold text-brand-primary hover:underline">
              Payout accounts
            </Link>
            .
          </p>
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
      </section>

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

      <Button fullWidth disabled={missing !== null || submitting} onClick={() => void handleSubmit()}>
        {submitting ? 'Submitting…' : (missing ?? 'Post offer')}
      </Button>
    </div>
  )
}
