import { useEffect, useState } from 'react'
import { fetchPlatformConfig, type PlatformConfig } from '@/api/platform'

interface State {
  data: PlatformConfig | null
  loading: boolean
  error: Error | null
}

const initial: State = { data: null, loading: true, error: null }

export function usePlatformConfig(): State {
  const [state, setState] = useState<State>(initial)

  useEffect(() => {
    const ctrl = new AbortController()
    let mounted = true

    fetchPlatformConfig(ctrl.signal)
      .then((data) => {
        if (mounted) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!mounted || ctrl.signal.aborted) return
        setState({ data: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) })
      })

    return () => {
      mounted = false
      ctrl.abort()
    }
  }, [])

  return state
}

/**
 * Convenience: returns fee percentages already converted from bps.
 *
 *   posterFeePct → the standard platform-fee rate
 *   seekerFeePct → the reduced rate applied when the escrow's creator is on a
 *                  Solana Mobile (Seeker) device
 *
 * WHICH RATE APPLIES vs WHO BEARS IT are two different questions, and the
 * names only answer the first. The CREATOR's Seeker status selects the rate
 * (`escrows.is_seeker` is baked from the poster/seller), but the fee is
 * DEDUCTED FROM THE COUNTERPARTY'S PAYOUT: both contracts settle
 * `amount − fee` to the worker/buyer (`_settleToCounterparty`,
 * `computeNetPayout`). This docstring used to say the fee was "charged to
 * posters / sellers" and that "workers and buyers pay zero today" — the exact
 * claim the landing copy was corrected for, left behind in the hook that
 * feeds the landing's fee figure.
 *
 * `null` while loading or on error — caller decides fallback.
 */
export function useFeePercents(): { posterFeePct: number | null; seekerFeePct: number | null } {
  const { data } = usePlatformConfig()
  if (!data) return { posterFeePct: null, seekerFeePct: null }
  return {
    posterFeePct: data.fee_bps / 100,
    seekerFeePct: data.seeker_fee_bps / 100,
  }
}
