import { useState } from 'react'
import { Alert } from 'react-native'
import { Transaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { api } from '@/api/client'
import { validateTransaction, signAndSendTransactionWithWallet, signTransactionsWithWallet, sendRawTransaction } from '@/wallet'
import { checkBalance } from '@/lib/balance'
import { uploadToCloudinary } from '@/lib/upload'
import type { PickedFile } from '@/components/form/FilePicker'
import { showToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/auth.store'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import type { PendingSync } from '@/stores/pending-sync.store'
import type { ExchangeOffer, ExchangeOfferDetail } from '@tenda/shared'
import { EXCHANGE_DISPUTE_REASON_MIN_LENGTH, computePlatformFee, SOLANA_TX_FEE_LAMPORTS } from '@tenda/shared'
import type { InstructionName } from '@tenda/shared/idl'

export function useExchangeActions(
  offer: ExchangeOfferDetail,
  onUpdated: (o: ExchangeOfferDetail) => void,
  onBack: () => void,
) {
  const [busy, setBusy] = useState(false)
  const authToken = useAuthStore((s) => s.mwaAuthToken ?? '')

  // Accept dual-tx state (setup + accept)
  const [pendingSetupSignature, setPendingSetupSignature] = useState<string | null>(null)
  const [pendingAcceptTx, setPendingAcceptTx]             = useState<Transaction | null>(null)
  const [pendingAcceptSignature, setPendingAcceptSignature] = useState<string | null>(null)

  function onNewAuthToken(token: string) {
    useAuthStore.getState().setMwaAuthToken(token)
  }

  // Distributed Omit helper to strip id/createdAt/retryCount from a PendingSync variant
  type SyncEntry = PendingSync extends infer T
    ? T extends { id: string; createdAt: number; retryCount: number }
      ? Omit<T, 'id' | 'createdAt' | 'retryCount'>
      : never
    : never

  async function runTx(
    buildTx: () => Promise<{ transaction: string }>,
    instruction: InstructionName,
    commit: (sig: string) => Promise<ExchangeOffer | null>,
    makeSyncEntry?: (sig: string) => SyncEntry,
  ): Promise<boolean> {
    setBusy(true)
    try {
      const { transaction: b64 } = await buildTx()
      const tx = Transaction.from(Buffer.from(b64, 'base64'))
      validateTransaction(tx, instruction)
      const sig = await signAndSendTransactionWithWallet(tx, authToken, onNewAuthToken)
      const syncId = makeSyncEntry ? usePendingSyncStore.getState().add(makeSyncEntry(sig)) : null
      try {
        const updated = await commit(sig)
        // confirm/dispute/cancel server routes return ExchangeOfferDetail shape (per #48 fix)
        if (updated) onUpdated(updated as ExchangeOfferDetail)
        if (syncId) usePendingSyncStore.getState().remove(syncId)
      } catch (commitErr) {
        // Commit failed — pending-sync will retry. Rethrow so the outer catch shows the error.
        throw commitErr
      }
      return true
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function publishOffer() {
    if (!authToken) return
    setBusy(true)
    try {
      const { fee_bps } = await api.platform.config()
      const lamports = BigInt(offer.lamports_amount)
      const required = lamports + BigInt(computePlatformFee(lamports, fee_bps)) + SOLANA_TX_FEE_LAMPORTS
      const walletAddress = useAuthStore.getState().walletAddress
      if (walletAddress) {
        const result = await checkBalance(walletAddress, required)
        if (!result.sufficient) {
          Alert.alert('Insufficient SOL', 'Your wallet does not have enough SOL to fund this offer. Please add SOL and try again.')
          return
        }
      }

      const { transaction: b64 } = await api.exchangeBlockchain.createEscrow({ offer_id: offer.id })
      const tx = Transaction.from(Buffer.from(b64, 'base64'))
      validateTransaction(tx, 'create_gig_escrow')
      const sig = await signAndSendTransactionWithWallet(tx, authToken, onNewAuthToken)
      const syncId = usePendingSyncStore.getState().add({ action: 'exchange_publish', offerId: offer.id, signature: sig })
      const updated = await api.exchange.publish({ id: offer.id }, { signature: sig })
      usePendingSyncStore.getState().remove(syncId)
      if (updated) onUpdated(updated)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function accept() {
    if (!authToken) return
    setBusy(true)
    try {
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
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
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
      // Remove the pending-sync entry added when the signature was broadcast
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

  function cancel() {
    const isDraft = offer.status === 'draft'
    Alert.alert(
      'Cancel Offer',
      isDraft ? 'Delete this draft offer?' : 'This will refund your SOL from escrow.',
      [
        { text: 'Keep Offer', style: 'cancel' },
        {
          text: 'Cancel', style: 'destructive',
          onPress: isDraft
            ? async () => {
                setBusy(true)
                try {
                  await api.exchange.cancel({ id: offer.id })
                  onBack()
                } catch (e) {
                  Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
                } finally {
                  setBusy(false)
                }
              }
            : () => runTx(
                () => api.exchangeBlockchain.cancel({ offer_id: offer.id }),
                'cancel_gig',
                async (_sig: string) => { await api.exchange.cancel({ id: offer.id }, { signature: _sig }); onBack(); return null },
                (sig) => ({ action: 'exchange_cancel', offerId: offer.id, signature: sig }),
              ),
        },
      ],
    )
  }

  async function markPaid(files: PickedFile[]): Promise<boolean> {
    if (files.length === 0) { Alert.alert('Add Proof', 'Attach at least one proof of payment.'); return false }
    setBusy(true)
    try {
      const proofs = await Promise.all(files.map(async (f) => ({ url: await uploadToCloudinary(f, 'proof'), type: f.type })))
      const { transaction: b64 } = await api.exchangeBlockchain.submitProof({ offer_id: offer.id })
      const tx = Transaction.from(Buffer.from(b64, 'base64'))
      validateTransaction(tx, 'submit_proof')
      const sig = await signAndSendTransactionWithWallet(tx, authToken, onNewAuthToken)
      const syncId = usePendingSyncStore.getState().add({ action: 'exchange_paid', offerId: offer.id, signature: sig, proofs })
      const updated = await api.exchange.paid({ id: offer.id }, { signature: sig, proofs })
      usePendingSyncStore.getState().remove(syncId)
      // paid server route returns ExchangeOfferDetail shape (per #48 fix)
      onUpdated(updated as ExchangeOfferDetail)
      showToast('success', 'Payment marked — waiting for seller to confirm')
      return true
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  function confirm() {
    Alert.alert(
      'Confirm Payment',
      'Confirm you received the fiat payment. This releases the SOL to the buyer.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Confirm & Release',
          onPress: () => runTx(
            () => api.exchangeBlockchain.confirm({ offer_id: offer.id }),
            'approve_completion',
            (sig) => api.exchange.confirm({ id: offer.id }, { signature: sig }),
            (sig) => ({ action: 'exchange_confirm', offerId: offer.id, signature: sig }),
          ),
        },
      ],
    )
  }

  async function dispute(reason: string): Promise<boolean> {
    if (reason.trim().length < EXCHANGE_DISPUTE_REASON_MIN_LENGTH) { Alert.alert('Provide Reason', `Please describe the issue (at least ${EXCHANGE_DISPUTE_REASON_MIN_LENGTH} characters).`); return false }
    return runTx(
      () => api.exchangeBlockchain.dispute({ offer_id: offer.id, reason }),
      'dispute_gig',
      (sig) => api.exchange.dispute({ id: offer.id }, { signature: sig, reason }),
      (sig) => ({ action: 'exchange_dispute', offerId: offer.id, signature: sig, reason }),
    )
  }

  return {
    busy,
    pendingSetupSignature,
    pendingAcceptSignature,
    onSetupConfirmed,
    onAcceptConfirmed,
    clearAcceptState,
    publishOffer,
    accept,
    cancel,
    markPaid,
    confirm,
    dispute,
  }
}
