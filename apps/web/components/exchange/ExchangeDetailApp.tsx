'use client'

/**
 * Exchange detail body — web port of mobile's ExchangeDetailContent over
 * the SAME machinery the gig detail proved: useEscrowActions (sign →
 * broadcast → client-ping), the TxConfirmDialog gate, TransactionMonitor
 * convergence, GigActionDialogs (proof/dispute/review/delete — structural
 * target, kind-agnostic), and escrow-live refresh.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TX_PROGRESS_LABEL,
  checkEscrowTransitionApplied,
  computeRelevantDeadline,
  formatAssetAmount,
  formatFiat,
  formatFullName,
  txSuccessCopy,
  type ActiveSheet,
  type EscrowTxType,
  type ExchangeDetail,
  type SupportedCurrency,
} from '@tenda/shared'
import { api } from '@/api/client'
import { useEscrowActions, type ProofFile } from '@/hooks/escrow/useEscrowActions'
import { useEscrowFee } from '@/hooks/escrow/useEscrowFee'
import { useEscrowLiveRefresh } from '@/hooks/escrow/live'
import { showToast } from '@/components/ui/Toast'
import { TxConfirmDialog } from '@/components/escrow/TxConfirmDialog'
import { TransactionMonitor } from '@/components/escrow/TransactionMonitor'
import { GigActionDialogs } from '@/components/gig/detail/action-dialogs'
import { TakedownNotice } from '@/components/gig/detail/TakedownNotice'
import { ExchangeStatusBadge } from '@/components/escrow/StatusBadge'
import { PersonCard } from '@/components/shared/PersonCard'
import { ExchangeTermsCard } from './ExchangeTermsCard'
import { ExchangeCTA } from './ExchangeCTA'
import {
  PaymentInstructionsCard,
  SellerPayoutCard,
  shouldShowPaymentInstructions,
  shouldShowSellerPayout,
} from './PayoutCards'
import { DisputeThreadLink } from './DisputeThreadLink'

export function ExchangeDetailApp({
  offer,
  userId,
  refresh,
}: {
  offer: ExchangeDetail
  userId: string
  refresh: () => Promise<void>
}) {
  const router = useRouter()
  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [confirmAction, setConfirmAction] = useState<EscrowTxType | null>(null)

  const actions = useEscrowActions({
    escrowId: offer.escrow_id,
    chainId: offer.chain_id,
    asset: offer.asset,
    amountRaw: offer.amount_raw,
    // A takedown refusal re-reads rather than leaving a declined button on
    // screen; `refresh` drops the offer on a 404.
    onStale: () => void refresh(),
  })
  const isCreator = userId === offer.creator.id

  // Buyer-net projection for the confirm dialogs (mirror-of-contract math).
  const { netRaw, feePct } = useEscrowFee(offer.is_seeker, offer.amount_raw)

  useEscrowLiveRefresh(offer.escrow_id, refresh, offer.status)

  function runConfirmedAction() {
    const action = confirmAction
    setConfirmAction(null)
    switch (action) {
      case 'create': return void actions.publish()
      case 'accept': return void actions.accept()
      case 'cancel': return void actions.cancel()
      case 'approve': return void actions.approve()
      case 'claim_stalled': return void actions.claim()
      // Declining is the only way out of a direct offer the invitee does
      // not want — the branch must exist even under a takedown.
      case 'decline': return void actions.decline()
    }
  }

  const fiat = formatFiat(Number(offer.fiat_amount), offer.fiat_currency as SupportedCurrency)
  const contextTitle = `Trade: ${offer.fiat_amount} ${offer.fiat_currency}`

  function handleTransactionConfirmed() {
    const action = actions.pendingAction
    actions.clearPending()
    if (action !== null) showToast('success', txSuccessCopy(action, 'exchange'))
    if (action === 'cancel') router.push('/exchange')
    else void refresh()
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <TakedownNotice escrow={offer} subject="offer" viewerId={userId} />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ExchangeStatusBadge status={offer.status} />
          <span className="rounded-full bg-accent-primary-surface px-2 py-0.5 text-[11px] font-semibold text-accent-primary">
            P2P Trade
          </span>
        </div>
        <h1 className="font-numeric font-display text-2xl font-bold text-content-primary">
          {formatAssetAmount(offer.amount_raw, offer.asset)} → {fiat}
        </h1>
      </header>

      <ExchangeTermsCard offer={offer} />

      {shouldShowPaymentInstructions(offer, userId) && offer.payout_account !== null && (
        <PaymentInstructionsCard
          account={offer.payout_account}
          fiatDisplay={fiat}
          reference={offer.escrow_id.slice(0, 8).toUpperCase()}
          status={offer.status}
          deadline={computeRelevantDeadline(offer)}
        />
      )}
      {shouldShowSellerPayout(offer, userId) && offer.payout_account !== null && (
        <SellerPayoutCard account={offer.payout_account} />
      )}

      <PersonCard
        user={offer.creator}
        label="Seller"
        currentUserId={userId}
        context={{ id: offer.escrow_id, title: contextTitle, kind: 'exchange' }}
      />
      {offer.counterparty !== null && (
        <PersonCard
          user={offer.counterparty}
          label="Buyer"
          currentUserId={userId}
          context={{ id: offer.escrow_id, title: contextTitle, kind: 'exchange' }}
        />
      )}

      {offer.proofs.length > 0 && (
        <section className="flex flex-col gap-1 rounded-card border border-border-subtle bg-surface-card p-4">
          <h2 className="text-sm font-semibold text-content-primary">Payment proof</h2>
          <ul className="flex flex-col gap-1">
            {offer.proofs.map((proof) => (
              <li key={proof.id}>
                <a
                  href={proof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-primary underline-offset-2 hover:underline"
                >
                  {proof.type} proof
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offer.dispute !== null && offer.status === 'disputed' && (
        <DisputeThreadLink
          reason={offer.dispute.reason}
          escrowId={offer.escrow_id}
          isParty={isCreator || userId === offer.counterparty?.id}
        />
      )}

      <div className="sticky bottom-4">
        <ExchangeCTA
          offer={offer}
          userId={userId}
          busy={actions.busyAction !== null}
          onTxAction={setConfirmAction}
          onSheet={setActiveSheet}
        />
      </div>

      <TxConfirmDialog
        action={confirmAction}
        ctx={{
          amount: formatAssetAmount(offer.amount_raw, offer.asset),
          kind: 'exchange',
          netAmount: netRaw !== null ? formatAssetAmount(netRaw.toString(), offer.asset) : null,
          feePct,
        }}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />

      <GigActionDialogs
        gig={offer}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onReviewSubmitted={() => void refresh()}
        onProofsReady={(proofs: ProofFile[]) => actions.submit(proofs)}
        onAddProofsReady={async (proofs: ProofFile[]) => {
          if (await actions.addProofs(proofs)) void refresh()
        }}
        onDisputeReady={(reason: string) => actions.dispute(reason, offer.dispute_bond_raw)}
      />

      <TransactionMonitor
        signature={actions.pendingTxRef}
        phase={actions.phase}
        actionLabel={actions.activeAction !== null ? TX_PROGRESS_LABEL[actions.activeAction] : undefined}
        escrowId={offer.escrow_id}
        chainId={offer.chain_id}
        checkApplied={() =>
          checkEscrowTransitionApplied(actions.pendingAction, () => api.exchange.get({ id: offer.escrow_id }))
        }
        onConfirmed={handleTransactionConfirmed}
        onFailed={(msg) => {
          actions.clearPending()
          showToast('info', msg || 'Transaction pending, will sync when confirmed')
        }}
      />
    </div>
  )
}

/** Seller name for headers elsewhere. */
export function sellerNameOf(offer: ExchangeDetail): string {
  return formatFullName(offer.creator.first_name, offer.creator.last_name) || 'Seller'
}
