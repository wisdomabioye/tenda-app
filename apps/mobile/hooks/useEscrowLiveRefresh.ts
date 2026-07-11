import { useEffect, useRef } from 'react'
import { subscribeEscrowChannel } from '@/stores/realtime.store'

/** Coalesce a burst of frames (e.g. both parties' clients pinging) into one refetch. */
const DEBOUNCE_MS = 400

/**
 * Live-refresh a detail screen when the escrow's on-chain state changes.
 *
 * Subscribes to the escrow WS channel — the same frames verify-tx republishes
 * on every confirmed transition — and calls `refresh` when a COUNTERPARTY's
 * action lands, so the screen updates without a manual pull-to-refresh. WS is
 * the live path; while disconnected the caller's focus refetch is the
 * fallback (no frames arrive, so nothing fires here).
 *
 * The refetch is idempotent, so this composes safely with TransactionMonitor's
 * own subscription for the local user's in-flight tx (at worst one extra,
 * harmless refetch when your own tx confirms).
 */
export function useEscrowLiveRefresh(
  escrowId: string | undefined,
  refresh: () => void | Promise<void>,
): void {
  // Keep the latest refresh without resubscribing when its identity changes.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    if (escrowId === undefined || escrowId === '') return
    let timer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = subscribeEscrowChannel(escrowId, () => {
      if (timer !== null) return // a refresh is already scheduled for this burst
      timer = setTimeout(() => {
        timer = null
        void refreshRef.current()
      }, DEBOUNCE_MS)
    })

    return () => {
      if (timer !== null) clearTimeout(timer)
      unsubscribe()
    }
  }, [escrowId])
}
