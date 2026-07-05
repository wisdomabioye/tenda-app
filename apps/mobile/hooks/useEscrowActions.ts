/**
 * Kind-agnostic escrow action hook (cutover §6), ONE implementation of
 * the v2 client leg shared by the gig and exchange detail screens:
 *
 *   request unsigned tx (escrow.store) → sign + broadcast + client-ping
 *   (wallet/dispatch) → TransactionMonitor/WS confirms → screen refreshes.
 *
 * Proof submission is two-phase: the proof FILES go to the off-chain
 * satellite (POST /v1/escrows/:id/proofs) first, then the on-chain submit
 * commits a digest over their URLs. The digest is sha256 over the
 * '\n'-joined URLs in upload order, encoded base58 for Solana chains,
 * 0x-hex for EVM (matching SubmitEscrowProofBody's per-chain format).
 */
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { sha256 } from '@noble/hashes/sha256'
import { Buffer } from 'buffer'
import bs58 from 'bs58'
import type { EscrowTxType, UnsignedTx } from '@tenda/shared'
import { useEscrowStore } from '@/stores/escrow.store'
import { signSendAndReport } from '@/wallet/dispatch'
import { buildPermitFor } from '@/wallet/permit'
import { api } from '@/api/client'
import { showToast } from '@/components/ui'
import {
  classifyTransactionGateError,
  TRANSACTION_GATE_MESSAGE,
  transactionGateRoute,
} from '@/lib/transaction-gate'

export interface ProofFile {
  url: string
  type: 'image' | 'video' | 'document'
}

/**
 * Lifecycle of a single transition, drives the progress modal:
 *  - preparing  → building the unsigned tx (server round-trip)
 *  - signing    → wallet is open, awaiting the user's signature + broadcast
 *  - confirming → broadcast, waiting on-chain confirmation (pendingTxRef set)
 */
export type TxPhase = 'idle' | 'preparing' | 'signing' | 'confirming'

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
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<EscrowTxType | null>(null)
  /** Feeds TransactionMonitor (signature + escrowId → WS-first confirm). */
  const [pendingTxRef, setPendingTxRef] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<EscrowTxType | null>(null)
  const [phase, setPhase] = useState<TxPhase>('idle')

  function clearPending() {
    setPendingTxRef(null)
    setPendingAction(null)
    setPhase('idle')
  }

  async function dispatch(
    action: EscrowTxType,
    request: () => Promise<UnsignedTx>,
  ): Promise<boolean> {
    setBusyAction(action)
    setPhase('preparing')
    try {
      const unsigned = await request()
      setPhase('signing')
      const tx_ref = await signSendAndReport({
        unsigned,
        action,
        chain_id: chainId,
        escrow_id: escrowId,
      })
      setPendingTxRef(tx_ref)
      setPendingAction(action)
      setPhase('confirming')
      onBroadcast?.(tx_ref, action)
      return true
    } catch (e) {
      setPhase('idle')
      // First-transaction gate (9D): route to link-wallet / verify-contact
      // instead of a dead-end toast. The 403 surfaces from request() (the
      // server build-tx call), before any wallet signing.
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
        return false
      }
      showToast('error', (e as Error).message || 'Transaction failed, please try again')
      return false
    } finally {
      setBusyAction(null)
    }
  }

  return {
    busyAction,
    pendingTxRef,
    pendingAction,
    /** Lifecycle for the progress modal (preparing → signing → confirming). */
    phase,
    /** Action currently in flight across all phases (build → confirm). */
    activeAction: busyAction ?? pendingAction,
    clearPending,

    /** Publish a draft: rebuild + sign the create tx (offramp drafts /
     *  signing-declined retries, the escrow id is preserved). */
    publish: () => dispatch('create', () => store.requestBuildCreate(escrowId)),
    accept: () => dispatch('accept', () => store.requestAccept(escrowId)),
    decline: () => dispatch('decline', () => store.requestDecline(escrowId)),
    approve: () => dispatch('approve', () => store.requestApprove(escrowId)),
    claim: () => dispatch('claim_stalled', () => store.requestClaim(escrowId)),
    cancel: () => dispatch('cancel', () => store.requestCancel(escrowId)),
    /**
     * One endpoint covers both recovery transitions; the PING action must
     * match the on-chain event exactly (verify-tx cross-checks it), so the
     * caller passes which one the escrow's status implies:
     * open → 'refund_expired', accepted → 'reclaim_abandoned'.
     */
    refund: (kind: 'refund_expired' | 'reclaim_abandoned') =>
      dispatch(kind, () => store.requestRefund(escrowId)),

    /** Upload satellite rows first, then commit the digest on-chain. */
    submit: async (proofs: ProofFile[]): Promise<boolean> => {
      setBusyAction('submit')
      setPhase('preparing')
      try {
        await api.escrows.addProofs({ id: escrowId }, { proofs })
      } catch (e) {
        setBusyAction(null)
        setPhase('idle')
        showToast('error', (e as Error).message || 'Failed to save proof files')
        return false
      }
      const proof_hash = proofHashFor(chainId, proofs.map((p) => p.url))
      return dispatch('submit', () => store.requestSubmit(escrowId, proof_hash))
    },

    /** Supplementary evidence while submitted, off-chain only. */
    addProofs: async (proofs: ProofFile[]): Promise<boolean> => {
      try {
        await api.escrows.addProofs({ id: escrowId }, { proofs })
        showToast('success', 'Proof added!')
        return true
      } catch (e) {
        showToast('error', (e as Error).message || 'Failed to add proof, please try again')
        return false
      }
    },

    /**
     * `asset` enables the EIP-2612 path for ERC-20 bonds (screens pass the
     * escrow's asset id); omitted or a zero bond falls back to the approve
     * hint on the unsigned tx.
     */
    dispute: (reason: string, bondRaw: string, asset?: string) =>
      dispatch('dispute', async () => {
        const permit =
          asset !== undefined && bondRaw !== '0'
            ? await buildPermitFor({ chain_id: chainId, asset, value_raw: bondRaw })
            : undefined
        return store.requestDispute(escrowId, bondRaw, reason, permit)
      }),
  }
}
