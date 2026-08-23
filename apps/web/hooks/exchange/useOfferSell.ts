/**
 * Web port of apps/mobile/components/wallet/sell/useOfferSell.ts: post a
 * P2P sell offer (kind='exchange' escrow) — create draft → attach offer
 * terms (a failure discards the draft) → wallet signs the on-chain
 * create. The payment window threads to BOTH the escrow completion
 * duration and the offer's payment window (one semantic). Preserves the
 * first-tx gate and the signing-declined → draft-survives path.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ApiClientError,
  InsufficientBalanceError,
  TRANSACTION_GATE_MESSAGE,
  classifyTransactionGateError,
  randomUuid,
  reuseOrCreateEscrowCreationAttempt,
  transactionGateRoute,
  type BankAccountSummary,
  type EscrowCreationAttempt,
} from '@tenda/shared'
import { api } from '@/api/client'
import { showToast } from '@/components/ui/Toast'
import {
  declaredSignerFor,
  ensureTxPreconditions,
  resolveSignersForChain,
  signSendAndReport,
} from '@/wallet/dispatch'
import { ensureSufficientBalance } from '@/wallet/balances'
import type { ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'

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

export function useOfferSell() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const submissionInFlight = useRef(false)
  const creationAttempt = useRef<EscrowCreationAttempt | null>(null)

  async function submit(a: OfferSubmitArgs): Promise<void> {
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    setSubmitting(true)
    let escrow_id: string | null = null
    try {
      creationAttempt.current = reuseOrCreateEscrowCreationAttempt(
        creationAttempt.current,
        [a.option.chainId, a.option.assetId, a.amountRaw, a.acceptHours,
          a.paymentWindowSeconds, a.account.id, a.fiatTotal, a.currency, a.rate],
        () => Math.floor(Date.now() / 1000) + a.acceptHours * SECONDS_PER_HOUR,
        randomUuid,
      )
      const { operationId, acceptDeadlineUnix } = creationAttempt.current

      // Trust list + chain registry FIRST (same rule as useGigFunding):
      // without them the owner set below is [] — the balance gate silently
      // falls open — and declaredSignerFor declares nothing, so the Solana
      // create would bake the server's primary guess.
      await ensureTxPreconditions()
      await ensureSufficientBalance({
        chainId: a.option.chainId,
        assetId: a.option.assetId,
        amountRaw: a.amountRaw,
        owners: resolveSignersForChain(a.option.chainId),
      })

      // Declared signer (signer contract): what gets baked into the Solana
      // create / enforced on the EVM wire is the wallet the user will
      // actually sign with, not the server's primary guess.
      const signer = declaredSignerFor(a.option.chainId)
      const created = await api.escrows.create({
        creation_operation_id: operationId,
        kind: 'exchange',
        chain_id: a.option.chainId,
        asset: a.option.assetId,
        amount_raw: a.amountRaw,
        accept_deadline_unix: acceptDeadlineUnix,
        completion_duration_seconds: a.paymentWindowSeconds,
        ...(signer !== undefined ? { signer_address: signer } : {}),
      })
      escrow_id = created.escrow_id
      creationAttempt.current = null

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
        // Terms failed to attach: discard the bare draft rather than leave an
        // unfundable orphan.
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
      router.replace(`/exchange/${created.escrow_id}`)
    } catch (e) {
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
      } else if (e instanceof InsufficientBalanceError) {
        // Carries the exact shortfall; the generic branch below would replace
        // it with "Failed to create the offer" and lose the one useful fact.
        showToast('error', e.message)
      } else if (escrow_id !== null) {
        // Terms saved but signing failed/declined, the draft survives (its
        // detail page carries the Publish/Delete CTA).
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete, draft saved')
        router.replace(`/exchange/${escrow_id}`)
      } else {
        showToast('error', e instanceof ApiClientError ? e.message : 'Failed to create the offer')
      }
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  return { submit, submitting }
}
