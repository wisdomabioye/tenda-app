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
 * `null` while loading, `null` on error — caller decides fallback.
 */
export function useFeePercents(): { posterFeePct: number | null; workerFeePct: number | null } {
  const { data } = usePlatformConfig()
  if (!data) return { posterFeePct: null, workerFeePct: null }
  return {
    posterFeePct: data.fee_bps / 100,
    workerFeePct: data.seeker_fee_bps / 100,
  }
}
