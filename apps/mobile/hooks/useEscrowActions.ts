/**
 * Kind-agnostic escrow action hook (cutover §6) — ONE implementation of
 * the v2 client leg shared by the gig and exchange detail screens:
 *
 *   request unsigned tx (escrow.store) → sign + broadcast + client-ping
 *   (wallet/dispatch) → TransactionMonitor/WS confirms → screen refreshes.
 *
 * Proof submission is two-phase: the proof FILES go to the off-chain
 * satellite (POST /v1/escrows/:id/proofs) first, then the on-chain submit
 * commits a digest over their URLs. The digest is sha256 over the
 * '\n'-joined URLs in upload order — encoded base58 for Solana chains,
 * 0x-hex for EVM (matching SubmitEscrowProofBody's per-chain format).
 */
import { useState } from 'react'
import { sha256 } from '@noble/hashes/sha256'
import { Buffer } from 'buffer'
import bs58 from 'bs58'
import type { EscrowTxType, UnsignedTx } from '@tenda/shared'
import { useEscrowStore } from '@/stores/escrow.store'
import { signSendAndReport } from '@/wallet/dispatch'
import { api } from '@/api/client'
import { showToast } from '@/components/ui'

export interface ProofFile {
  url: string
  type: 'image' | 'video' | 'document'
}

export function proofHashFor(chainId: string, urls: string[]): string {
  const digest = sha256(new TextEncoder().encode(urls.join('\n')))
  return chainId.startsWith('solana:')
    ? bs58.encode(digest)
    : `0x${Buffer.from(digest).toString('hex')}`
}

interface UseEscrowActionsArgs {
  escrowId: string
  chainId: string
  /** Called after a tx is broadcast + reported (screen refreshes on WS confirm). */
  onBroadcast?: (txRef: string, action: EscrowTxType) => void
}

export function useEscrowActions({ escrowId, chainId, onBroadcast }: UseEscrowActionsArgs) {
  const store = useEscrowStore()
  const [busyAction, setBusyAction] = useState<EscrowTxType | null>(null)
  /** Feeds TransactionMonitor (signature + escrowId → WS-first confirm). */
  const [pendingTxRef, setPendingTxRef] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<EscrowTxType | null>(null)

  function clearPending() {
    setPendingTxRef(null)
    setPendingAction(null)
  }

  async function dispatch(
    action: EscrowTxType,
    request: () => Promise<UnsignedTx>,
  ): Promise<boolean> {
    setBusyAction(action)
    try {
      const unsigned = await request()
      const tx_ref = await signSendAndReport({
        unsigned,
        action,
        chain_id: chainId,
        escrow_id: escrowId,
      })
      setPendingTxRef(tx_ref)
      setPendingAction(action)
      onBroadcast?.(tx_ref, action)
      return true
    } catch (e) {
      showToast('error', (e as Error).message || 'Transaction failed — please try again')
      return false
    } finally {
      setBusyAction(null)
    }
  }

  return {
    busyAction,
    pendingTxRef,
    pendingAction,
    clearPending,

    accept: () => dispatch('accept', () => store.requestAccept(escrowId)),
    decline: () => dispatch('decline', () => store.requestDecline(escrowId)),
    approve: () => dispatch('approve', () => store.requestApprove(escrowId)),
    claim: () => dispatch('claim_stalled', () => store.requestClaim(escrowId)),
    cancel: () => dispatch('cancel', () => store.requestCancel(escrowId)),
    /** Covers refund_expired AND reclaim_abandoned — the server picks by status. */
    refund: () => dispatch('refund_expired', () => store.requestRefund(escrowId)),

    /** Upload satellite rows first, then commit the digest on-chain. */
    submit: async (proofs: ProofFile[]): Promise<boolean> => {
      setBusyAction('submit')
      try {
        await api.escrows.addProofs({ id: escrowId }, { proofs })
      } catch (e) {
        setBusyAction(null)
        showToast('error', (e as Error).message || 'Failed to save proof files')
        return false
      }
      const proof_hash = proofHashFor(chainId, proofs.map((p) => p.url))
      return dispatch('submit', () => store.requestSubmit(escrowId, proof_hash))
    },

    /** Supplementary evidence while submitted — off-chain only. */
    addProofs: async (proofs: ProofFile[]): Promise<boolean> => {
      try {
        await api.escrows.addProofs({ id: escrowId }, { proofs })
        showToast('success', 'Proof added!')
        return true
      } catch (e) {
        showToast('error', (e as Error).message || 'Failed to add proof — please try again')
        return false
      }
    },

    dispute: (reason: string, bondRaw: string) =>
      dispatch('dispute', () => store.requestDispute(escrowId, bondRaw, reason)),
  }
}
