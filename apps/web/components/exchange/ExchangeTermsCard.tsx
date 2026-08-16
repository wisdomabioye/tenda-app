'use client'

/**
 * Terms card for the exchange detail — web twin of mobile's: rate,
 * network, payment window, the buyer's TRUE net (amount − platform fee —
 * the headline gross alone misstates the trade), and the live
 * status-aware stage deadline.
 */
import type { ReactNode } from 'react'
import {
  ASSET_META,
  chainLabel,
  computeRelevantDeadline,
  formatAssetAmount,
  formatDate,
  formatFiat,
  formatPaymentWindow,
  type EscrowStatus,
  type ExchangeDetail,
  type SupportedCurrency,
} from '@tenda/shared'
import { useEscrowFee } from '@/hooks/escrow/useEscrowFee'
import { DeadlineCountdown } from '@/components/shared/DeadlineCountdown'

/**
 * Status-aware label for the single live-deadline row — deliberately
 * DISTINCT from gig wording: a P2P buyer ACCEPTS, PAYS within the window,
 * then the seller CONFIRMS receipt.
 */
const DEADLINE_LABEL: Partial<Record<EscrowStatus, string>> = {
  open: 'Accept in',
  accepted: 'Pay in',
  submitted: 'Confirm in',
}

interface TermRow {
  label: string
  value: string | ReactNode
  emphasis?: boolean
}

export function ExchangeTermsCard({ offer }: { offer: ExchangeDetail }) {
  const rate = formatFiat(Number(offer.rate), offer.fiat_currency as SupportedCurrency)
  const symbol = ASSET_META[offer.asset]?.symbol ?? offer.asset

  const { feeRaw, netRaw, feePct } = useEscrowFee(offer.is_seeker, offer.amount_raw)

  const rows: TermRow[] = [
    { label: 'Rate', value: `${rate} / ${symbol}` },
    { label: 'Network', value: chainLabel(offer.chain_id) },
    { label: 'Payment window', value: formatPaymentWindow(offer.payment_window_seconds) },
    {
      label: `Platform fee${feePct !== null ? ` (${feePct}%)` : ''}`,
      value: feeRaw !== null ? `− ${formatAssetAmount(feeRaw.toString(), offer.asset)}` : '—',
    },
    {
      label: 'Buyer receives',
      value: netRaw !== null ? formatAssetAmount(netRaw.toString(), offer.asset) : '—',
      emphasis: true,
    },
  ]
  if (offer.created_at !== null) {
    rows.push({ label: 'Listed', value: formatDate(offer.created_at) })
  }

  const deadline = computeRelevantDeadline(offer)
  const deadlineLabel = DEADLINE_LABEL[offer.status]
  if (deadline !== null && deadlineLabel !== undefined) {
    rows.push({
      label: deadlineLabel,
      value: <DeadlineCountdown deadline={deadline} className="text-content-primary" />,
      emphasis: true,
    })
  }

  return (
    <dl className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface-card p-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-content-secondary">{row.label}</dt>
          <dd
            className={
              row.emphasis
                ? 'text-right font-numeric font-semibold text-content-primary'
                : 'text-right font-numeric text-content-primary'
            }
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
