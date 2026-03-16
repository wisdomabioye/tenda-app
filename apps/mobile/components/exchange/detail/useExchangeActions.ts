import { useState } from 'react'
import { Alert } from 'react-native'
import { Transaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { api } from '@/api/client'
import {
  validateTransaction,
  signAndSendTransactionWithWallet,
  signTransactionsWithWallet,
  sendRawTransaction,
  WalletError,
} from '@/wallet'
import { checkBalance } from '@/lib/balance'
import { uploadToCloudinary } from '@/lib/upload'
import type { PickedFile } from '@/components/form/FilePicker'
import { showToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/auth.store'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import type { PendingSync } from '@/stores/pending-sync.store'
import type { ExchangeOfferDetail } from '@tenda/shared'
import { EXCHANGE_DISPUTE_REASON_MIN_LENGTH, computePlatformFee, SOLANA_TX_FEE_LAMPORTS } from '@tenda/shared'
import type { InstructionName } from '@tenda/shared/idl'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExchangePendingAction =
  | { type: 'publish' }
  | { type: 'markPaid'; proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }> }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'dispute'; reason: string }
  | { type: 'refundExpired' }

// Distributed Omit — strips auto-generated fields from each union member.
type SyncEntry = PendingSync extends infer T
  ? T extends { id: string; createdAt: number; retryCount: number }
    ? Omit<T, 'id' | 'createdAt' | 'retryCount'>
    : never
  : never

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExchangeActions(
  offer: ExchangeOfferDetail,
  onUpdated: (o: ExchangeOfferDetail) => void,
  onBack: () => void,
) {
  const authToken = useAuthStore((s) => s.mwaAuthToken ?? '')
  const isSeeker  = useAuthStore((s) => s.user?.is_seeker ?? false)

  // Upload/non-tx loading (e.g. draft cancel, file upload phase of markPaid)
  const [busy, setBusy] = useState(false)
  // True while building the tx + signing (before broadcast)
  const [isTxBuilding, setIsTxBuilding] = useState(false)
  // Signature being monitored by the main TransactionMonitor
  const [pendingSignature, setPendingSignature]   = useState<string | null>(null)
  const [pendingAction, setPendingAction]         = useState<ExchangePendingAction | null>(null)
  const [pendingSyncId, setPendingSyncId]         = useState<string | null>(null)

  // Accept dual-tx state (setup account + accept offer)
  const [pendingSetupSignature, setPendingSetupSignature]   = useState<string | null>(null)
  const [pendingAcceptTx, setPendingAcceptTx]               = useState<Transaction | null>(null)
  const [pendingAcceptSignature, setPendingAcceptSignature] = useState<string | null>(null)

  // True while ANY signature is being monitored — used to lock down the CTA bar
  const txInProgress = pendingSignature !== null
    || pendingAcceptSignature !== null
    || pendingSetupSignature !== null

  function onNewAuthToken(token: string) {
    useAuthStore.getState().setMwaAuthToken(token)
  }

  // ── Balance guard ──────────────────────────────────────────────────────────

  async function guardBalance(required: bigint): Promise<boolean> {
    const walletAddress = useAuthStore.getState().walletAddress
    if (!walletAddress) return true
    const result = await checkBalance(walletAddress, required)
    if (!result.sufficient) {
      Alert.alert('Insufficient SOL', 'Your wallet does not have enough SOL to cover this transaction.')
      return false
    }
    return true
  }

  // ── Core: sign tx → add sync entry → enter monitoring state ───────────────
  // Mirrors gig's startBlockchainFlow. Returns true if monitoring started,
  // false if user cancelled (silent). Throws for all other errors (caller shows toast).

  async function startBlockchainFlow(
    action: ExchangePendingAction,
    txBase64: string,
    expectedInstruction: InstructionName,
    makeSyncEntry?: (sig: string) => SyncEntry,
  ): Promise<boolean> {
    if (!authToken) {
      showToast('error', 'Wallet not connected — please reconnect and try again')
      return false
    }
    try {
      const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
      validateTransaction(tx, expectedInstruction)
      const sig = await signAndSendTransactionWithWallet(tx, authToken, onNewAuthToken)
      if (makeSyncEntry) {
        const syncId = usePendingSyncStore.getState().add(makeSyncEntry(sig))
        setPendingSyncId(syncId)
      }
      setPendingAction(action)
      setPendingSignature(sig)
      return true
    } catch (e) {
      setPendingSignature(null)
      setPendingAction(null)
      setPendingSyncId(null)
      if (e instanceof WalletError && e.code === 'declined') return false
      throw e  // re-throw; caller catches and shows toast
    }
  }

  // ── TransactionMonitor confirmed callback ──────────────────────────────────

  async function onTxConfirmed() {
    const sig    = pendingSignature!
    const action = pendingAction!
    const syncId = pendingSyncId
    setPendingSignature(null)
    setPendingAction(null)
    setPendingSyncId(null)

    const successMessages: Record<ExchangePendingAction['type'], string> = {
      publish:       'Offer published!',
      markPaid:      'Payment marked — waiting for seller to confirm',
      confirm:       'Payment confirmed — SOL released to buyer!',
      cancel:        'Offer cancelled — escrow refunded.',
      dispute:       'Dispute raised. An admin will review shortly.',
      refundExpired: 'Refund claimed — SOL returned to your wallet.',
    }

    try {
      switch (action.type) {
        case 'publish': {
          const updated = await api.exchange.publish({ id: offer.id }, { signature: sig })
          onUpdated(updated)
          break
        }
        case 'markPaid': {
          const updated = await api.exchange.paid({ id: offer.id }, { signature: sig, proofs: action.proofs })
          onUpdated(updated as ExchangeOfferDetail)
          break
        }
        case 'confirm': {
          const updated = await api.exchange.confirm({ id: offer.id }, { signature: sig })
          onUpdated(updated as ExchangeOfferDetail)
          break
        }
        case 'cancel': {
          await api.exchange.cancel({ id: offer.id }, { signature: sig })
          showToast('success', successMessages.cancel)
          onBack()
          return  // skip generic toast + sync removal (already navigated away)
        }
        case 'dispute': {
          const updated = await api.exchange.dispute({ id: offer.id }, { signature: sig, reason: action.reason })
          onUpdated(updated as ExchangeOfferDetail)
          break
        }
        case 'refundExpired': {
          await api.exchange.refund({ id: offer.id }, { signature: sig })
          showToast('success', successMessages.refundExpired)
          onBack()
          return  // already navigated away
        }
      }

      if (syncId) usePendingSyncStore.getState().remove(syncId)

      showToast('success', successMessages[action.type])
    } catch {
      showToast('info', 'Changes saved locally — will sync when reconnected')
    }
  }

  function clearTxState() {
    setPendingSignature(null)
    setPendingAction(null)
    setPendingSyncId(null)
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  async function publishOffer() {
    if (!authToken) return
    setIsTxBuilding(true)
    try {
      const { fee_bps, seeker_fee_bps } = await api.platform.config()
      const effectiveFeeBps = isSeeker ? seeker_fee_bps : fee_bps
      const lamports = BigInt(offer.lamports_amount)
      const required = lamports + BigInt(computePlatformFee(lamports, effectiveFeeBps)) + SOLANA_TX_FEE_LAMPORTS
      if (!await guardBalance(required)) return

      const { transaction: b64 } = await api.exchangeBlockchain.createEscrow({ offer_id: offer.id })
      await startBlockchainFlow(
        { type: 'publish' },
        b64,
        'create_gig_escrow',
        (sig) => ({ action: 'exchange_publish', offerId: offer.id, signature: sig }),
      )
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build publish transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  // ── Accept (dual-tx setup path) ────────────────────────────────────────────

  async function accept() {
    if (!authToken) return
    setIsTxBuilding(true)
    try {
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return

      const response = await api.exchangeBlockchain.accept({ offer_id: offer.id })

      if (response.setup_transaction) {
        showToast('info', 'One-time setup: your buyer account will be created on-chain. This only happens once.')
        await new Promise<void>((r) => setTimeout(r, 1200))

        const setupTx  = Transaction.from(Buffer.from(response.setup_transaction, 'base64'))
        const acceptTx = Transaction.from(Buffer.from(response.transaction, 'base64'))
        validateTransaction(setupTx, 'create_user_account')
        validateTransaction(acceptTx, 'accept_gig')
        const [signedSetup, signedAccept] = await signTransactionsWithWallet(
          [setupTx, acceptTx],
          authToken,
          onNewAuthToken,
        ) as [Transaction, Transaction]

        const setupSig = await sendRawTransaction(signedSetup)
        setPendingAcceptTx(signedAccept)
        setPendingSetupSignature(setupSig)
      } else {
        const tx = Transaction.from(Buffer.from(response.transaction, 'base64'))
        validateTransaction(tx, 'accept_gig')
        const sig = await signAndSendTransactionWithWallet(tx, authToken, onNewAuthToken)
        usePendingSyncStore.getState().add({ action: 'exchange_accept', offerId: offer.id, signature: sig })
        setPendingAcceptSignature(sig)
      }
    } catch (e) {
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      if (!(e instanceof WalletError && e.code === 'declined'))
        showToast('error', (e as Error).message || 'Failed to build accept transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  async function onSetupConfirmed() {
    if (!pendingAcceptTx) return
    try {
      const acceptSig = await sendRawTransaction(pendingAcceptTx)
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      usePendingSyncStore.getState().add({ action: 'exchange_accept', offerId: offer.id, signature: acceptSig })
      setPendingAcceptSignature(acceptSig)
    } catch (e) {
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      showToast('error', e instanceof Error ? e.message : 'Failed to broadcast accept transaction')
    }
  }

  async function onAcceptConfirmed() {
    const sig = pendingAcceptSignature!
    setPendingAcceptSignature(null)
    try {
      const updated = await api.exchange.accept({ id: offer.id }, { signature: sig })
      const syncItem = usePendingSyncStore.getState().queue.find(
        (i) => i.action === 'exchange_accept' && 'offerId' in i && i.offerId === offer.id && i.signature === sig,
      )
      if (syncItem) usePendingSyncStore.getState().remove(syncItem.id)
      onUpdated(updated)
      showToast('success', 'Offer accepted!')
    } catch {
      showToast('info', 'Accepted on-chain — will sync when reconnected')
    }
  }

  function clearAcceptState() {
    setPendingSetupSignature(null)
    setPendingAcceptTx(null)
    setPendingAcceptSignature(null)
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  function cancel() {
    const isDraft = offer.status === 'draft'
    Alert.alert(
      'Cancel Offer',
      isDraft ? 'Delete this draft offer?' : 'This will refund your SOL from escrow.',
      [
        { text: 'Keep Offer', style: 'cancel' },
        {
          text: isDraft ? 'Delete' : 'Cancel', style: 'destructive',
          onPress: isDraft ? handleCancelDraft : handleCancelOpen,
        },
      ],
    )
  }

  async function handleCancelDraft() {
    setBusy(true)
    try {
      await api.exchange.cancel({ id: offer.id })
      onBack()
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancelOpen() {
    setIsTxBuilding(true)
    try {
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction: b64 } = await api.exchangeBlockchain.cancel({ offer_id: offer.id })
      await startBlockchainFlow(
        { type: 'cancel' },
        b64,
        'cancel_gig',
        (sig) => ({ action: 'exchange_cancel', offerId: offer.id, signature: sig }),
      )
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build cancel transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  // ── Mark paid (upload + blockchain) ───────────────────────────────────────

  async function markPaid(files: PickedFile[]): Promise<boolean> {
    if (files.length === 0) { Alert.alert('Add Proof', 'Attach at least one proof of payment.'); return false }
    if (!authToken) return false

    setBusy(true)
    try {
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return false

      const proofs = await Promise.all(
        files.map(async (f) => ({ url: await uploadToCloudinary(f, 'proof'), type: f.type })),
      )

      setBusy(false)
      setIsTxBuilding(true)

      const { transaction: b64 } = await api.exchangeBlockchain.submitProof({ offer_id: offer.id })
      return await startBlockchainFlow(
        { type: 'markPaid', proofs },
        b64,
        'submit_proof',
        (sig) => ({ action: 'exchange_paid', offerId: offer.id, signature: sig, proofs }),
      )
    } catch (e) {
      if (!(e instanceof WalletError && e.code === 'declined'))
        showToast('error', e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
      setIsTxBuilding(false)
    }
  }

  // ── Confirm payment ────────────────────────────────────────────────────────

  function confirm() {
    Alert.alert(
      'Confirm Payment',
      'Confirm you received the fiat payment. This releases the SOL to the buyer.',
      [
        { text: 'Not Yet', style: 'cancel' },
        { text: 'Confirm & Release', onPress: handleConfirm },
      ],
    )
  }

  async function handleConfirm() {
    setIsTxBuilding(true)
    try {
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction: b64 } = await api.exchangeBlockchain.confirm({ offer_id: offer.id })
      await startBlockchainFlow(
        { type: 'confirm' },
        b64,
        'approve_completion',
        (sig) => ({ action: 'exchange_confirm', offerId: offer.id, signature: sig }),
      )
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build confirm transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  // ── Dispute ────────────────────────────────────────────────────────────────

  async function dispute(reason: string): Promise<boolean> {
    if (reason.trim().length < EXCHANGE_DISPUTE_REASON_MIN_LENGTH) {
      Alert.alert('Provide Reason', `Please describe the issue (at least ${EXCHANGE_DISPUTE_REASON_MIN_LENGTH} characters).`)
      return false
    }
    setIsTxBuilding(true)
    try {
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return false
      const { transaction: b64 } = await api.exchangeBlockchain.dispute({ offer_id: offer.id, reason })
      return await startBlockchainFlow(
        { type: 'dispute', reason },
        b64,
        'dispute_gig',
        (sig) => ({ action: 'exchange_dispute', offerId: offer.id, signature: sig, reason }),
      )
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build dispute transaction')
      return false
    } finally {
      setIsTxBuilding(false)
    }
  }

  // ── Refund expired ─────────────────────────────────────────────────────────

  async function refundExpired() {
    if (!authToken) return
    Alert.alert(
      'Claim Refund',
      'The offer has expired. Claim your SOL back from escrow?',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Claim Refund', onPress: handleRefundExpired },
      ],
    )
  }

  async function handleRefundExpired() {
    setIsTxBuilding(true)
    try {
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction: b64 } = await api.exchangeBlockchain.refund({ offer_id: offer.id })
      await startBlockchainFlow(
        { type: 'refundExpired' },
        b64,
        'refund_expired',
        (sig) => ({ action: 'exchange_refund', offerId: offer.id, signature: sig }),
      )
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build refund transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  return {
    busy,
    isTxBuilding,
    txInProgress,
    pendingSignature,
    pendingSetupSignature,
    pendingAcceptSignature,
    onSetupConfirmed,
    onAcceptConfirmed,
    onTxConfirmed,
    clearAcceptState,
    clearTxState,
    publishOffer,
    accept,
    cancel,
    markPaid,
    confirm,
    dispute,
    refundExpired,
  }
}
