/**
 * The post-a-gig funding lifecycle, extracted from the screen so the screen
 * stays a view. Sibling to useEscrowActions: that one drives transitions on an
 * EXISTING escrow, this one drives creation.
 *
 * Confirmed → v2 create chain (cutover §6): 1) draft escrow + unsigned create
 * tx, 2) attach gig_details (Stage-6 moderation gate, a block deletes the
 * orphan draft), 3) wallet signs + broadcasts + client-pings. The gig goes live
 * (draft → open) when the verify pipeline confirms the tx; the progress modal
 * holds until then.
 */
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { coerceCityForCountry, ErrorCode } from '@tenda/shared'
import { api, ApiClientError } from '@/api/client'
import { showToast } from '@/components/ui/Toast'
import { WalletError } from '@/wallet/errors'
import { resolveSignersForChain, signSendAndReport } from '@/wallet/dispatch'
import { useNotificationPromptStore } from '@/stores/notification-prompt.store'
import { ensureSufficientBalance } from '@/wallet/balances'
import { buildPermitFor } from '@/wallet/permit'
import type { TxPhase } from '@/hooks/useEscrowActions'
import {
  classifyTransactionGateError,
  TRANSACTION_GATE_MESSAGE,
  transactionGateRoute,
} from '@/lib/transaction-gate'
import type { GigFormValues } from '@/components/gig/GigForm'

const MS_PER_HOUR = 3_600_000

interface FundingMonitor {
  signature: string
  escrowId: string
  chainId: string
}

interface UseGigFundingArgs {
  /** Present when reposting an abandoned draft (CO6 retry-from-draft). */
  draftId?: string
  /** Drop the draft prefill once funding has left the screen. */
  clearDraftPrefill: () => void
}

export function useGigFunding({ draftId, clearDraftPrefill }: UseGigFundingArgs) {
  const router = useRouter()
  // pendingValues drives the confirm dialog; once confirmed, phase + signature
  // drive the shared progress modal, which holds until the escrow confirms
  // on-chain (then we navigate).
  const [pendingValues, setPendingValues] = useState<GigFormValues | null>(null)
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [monitor, setMonitor] = useState<FundingMonitor | null>(null)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)

  async function runFunding() {
    if (pendingValues === null || !pendingValues.category) return
    const values = pendingValues
    const category = pendingValues.category
    setPendingValues(null)

    const safeCity = coerceCityForCountry(values.country, values.city)
    // CO5: chain + USDC asset come from the form's picker (policy pair from the
    // shared gigAssetByChain helper, the server re-asserts it).
    const chain_id = values.chainId
    const asset = values.asset
    const amount_raw = String(values.paymentRaw)
    const accept_deadline_unix = Math.floor(
      (Date.now() + values.acceptDeadlineHours * MS_PER_HOUR) / 1000,
    )

    setPhase('preparing')
    let escrow_id: string | null = null
    try {
      // Before the permit signature and the draft: an underfunded creator would
      // otherwise sign a permit, wait, and watch the create revert — leaving a
      // draft to retry. Falls open when the balance can't be read.
      await ensureSufficientBalance({
        chainId: chain_id,
        assetId: asset,
        amountRaw: amount_raw,
        owners: resolveSignersForChain(chain_id),
      })

      // EIP-2612: sign the allowance BEFORE creating so it rides the create tx
      // (undefined = approve fallback via the unsigned tx's approval hint).
      const permit = await buildPermitFor({ chain_id, asset, value_raw: amount_raw })
      const created = await api.escrows.create({
        kind: 'gig',
        chain_id,
        asset,
        amount_raw,
        accept_deadline_unix,
        completion_duration_seconds: values.completionDuration,
        ...(permit !== undefined ? { permit } : {}),
      })
      escrow_id = created.escrow_id

      try {
        await api.gigs.create({
          escrow_id: created.escrow_id,
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          category,
          country: values.country ?? undefined,
          remote: values.remote,
          city: safeCity || undefined,
          ...(values.proofRequirements.length > 0
            ? { proof_requirements: values.proofRequirements }
            : {}),
        })
      } catch (e) {
        // Stage-6 block (or validation failure): the chain-agnostic draft would
        // be an orphan, discard it before surfacing the error.
        await api.escrows.delete({ id: created.escrow_id }).catch(() => {})
        escrow_id = null
        throw e
      }

      // Retry-from-draft: the listing now lives on the NEW draft, discard the
      // abandoned one. A 409 (its create tx is still pending) leaves it alone;
      // it stays deletable from its own page.
      if (draftId !== undefined && draftId !== created.escrow_id) {
        await api.escrows.delete({ id: draftId }).catch(() => {})
      }

      setPhase('signing')
      const tx_ref = await signSendAndReport({
        unsigned: created.unsigned,
        action: 'create',
        chain_id,
        escrow_id: created.escrow_id,
      })

      // Hold the progress modal on-chain-confirm instead of navigating away
      // blind (the newcomer's "did it work?" gap).
      setPhase('confirming')
      setMonitor({ signature: tx_ref, escrowId: created.escrow_id, chainId: chain_id })
    } catch (e) {
      setPhase('idle')
      // 9D first-transaction gate: route to link-wallet / verify-contact. It
      // surfaces from escrows.create() before escrow_id is set, so there is no
      // orphan draft to clean up here.
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
      } else if (e instanceof ApiClientError && e.code === ErrorCode.CONTENT_MODERATED) {
        // Stage-6: block verdicts get the full dialog, no retry path.
        setBlockedMessage(e.message)
      } else if (escrow_id !== null) {
        // Details saved but signing failed/declined/timed out, the draft
        // survives with a Delete Draft CTA on its page. If the wallet actually
        // broadcast a timed-out create, the server's chain listener confirms
        // it and the draft flips to open on its own.
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete, draft saved')
        router.push(`/gig/${escrow_id}`)
      } else if (e instanceof WalletError && (e.code === 'declined' || e.code === 'timeout')) {
        // Guard exit before the draft existed (e.g. the permit signature was
        // cancelled or lost) — an expected path, not a failure.
        showToast('info', e.message)
      } else {
        // Covers InsufficientBalanceError, whose message names the shortfall.
        showToast('error', e instanceof Error ? e.message : 'Failed to create gig')
      }
    }
  }

  // Tear down the progress modal, clear the retry-draft param, and land on the
  // gig's page. Shared by the confirmed and timed-out exits (they differ only
  // in the toast).
  function leaveAfterFunding(type: 'success' | 'info', message: string) {
    const escrowId = monitor?.escrowId
    setMonitor(null)
    setPhase('idle')
    showToast(type, message)
    if (draftId !== undefined) {
      clearDraftPrefill()
      router.setParams({ draftId: '' })
    }
    router.navigate('/(tabs)/home')
    if (escrowId !== undefined) router.push(`/gig/${escrowId}`)
  }

  return {
    pendingValues,
    setPendingValues,
    phase,
    monitor,
    blockedMessage,
    dismissBlocked: () => setBlockedMessage(null),
    runFunding,
    /** Escrow confirmed on-chain → the gig is live. */
    handleFunded: () => {
      // First real commitment, this is what earns the just-in-time notification
      // re-ask for a user who declined earlier.
      void useNotificationPromptStore.getState().recordCommitment()
      leaveAfterFunding('success', 'Gig funded and live!')
    },
    /**
     * Timed out / soft failure: the escrow will sync when it confirms; land on
     * the gig page (draft or live) rather than trapping the user in the modal.
     */
    handleFundTimeout: (msg: string) =>
      leaveAfterFunding('info', msg || 'Submitted — it will go live once the escrow confirms.'),
  }
}
