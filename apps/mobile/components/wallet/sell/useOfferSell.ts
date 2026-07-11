import { useState } from 'react'
import { useRouter } from 'expo-router'
import type { BankAccountSummary } from '@tenda/shared'
import { api, ApiClientError } from '@/api/client'
import { showToast } from '@/components/ui'
import { signSendAndReport } from '@/wallet/dispatch'
import {
  classifyTransactionGateError,
  TRANSACTION_GATE_MESSAGE,
  transactionGateRoute,
} from '@/lib/transaction-gate'
import type { ExchangeAssetOption } from '@/hooks/useExchangeAssetOptions'

const SECONDS_PER_HOUR = 60 * 60

export interface OfferSubmitArgs {
  option: ExchangeAssetOption
  amountRaw: string
  account: BankAccountSummary
  fiatTotal: number
  currency: string
  rate: number
  acceptHours: number
  paymentWindowSeconds: number
}

/**
 * Post a P2P sell offer (kind='exchange' escrow): create draft → attach offer
 * terms (a failure discards the draft) → wallet signs the on-chain create. The
 * accept + payment windows are caller-chosen; the payment window threads to
 * BOTH the escrow completion duration and the offer's payment window (one
 * semantic). Preserves the 9D first-tx gate and the signing-declined → draft
 * survives path.
 */
export function useOfferSell() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function submit(a: OfferSubmitArgs): Promise<void> {
    if (submitting) return
    const accept_deadline_unix = Math.floor(Date.now() / 1000) + a.acceptHours * SECONDS_PER_HOUR

    setSubmitting(true)
    let escrow_id: string | null = null
    try {
      const created = await api.escrows.create({
        kind: 'exchange',
        chain_id: a.option.chainId,
        asset: a.option.assetId,
        amount_raw: a.amountRaw,
        accept_deadline_unix,
        completion_duration_seconds: a.paymentWindowSeconds,
      })
      escrow_id = created.escrow_id

      try {
        await api.exchange.create({
          escrow_id: created.escrow_id,
          fiat_amount: a.fiatTotal,
          fiat_currency: a.currency,
          rate: a.rate,
          payment_window_seconds: a.paymentWindowSeconds,
          payout_account_id: a.account.id,
        })
      } catch (e) {
        // Validation failure: discard the orphan draft before surfacing.
        await api.escrows.delete({ id: created.escrow_id }).catch(() => {})
        escrow_id = null
        throw e
      }

      await signSendAndReport({
        unsigned: created.unsigned,
        action: 'create',
        chain_id: a.option.chainId,
        escrow_id: created.escrow_id,
      })

      showToast('success', 'Offer submitted! It hits the order book once the escrow confirms.')
      router.replace(`/exchange/${created.escrow_id}` as Parameters<typeof router.replace>[0])
    } catch (e) {
      // 9D first-transaction gate: route to link-wallet / verify-contact.
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
      } else if (escrow_id !== null) {
        // Terms saved but signing failed/declined, the draft survives.
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete, draft saved')
        router.replace(`/exchange/${escrow_id}` as Parameters<typeof router.replace>[0])
      } else {
        showToast('error', e instanceof ApiClientError ? e.message : 'Failed to create the offer')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, submit }
}
