'use client'

/**
 * Stage-0 smoke probe, replaced by real surfaces in Stage 1. Calls
 * GET /v1/platform/config from the BROWSER through the ported api client —
 * one render proves CORS, the inlined base URL, and the client stack
 * end-to-end (stage-0 DoD, task 0.7).
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/client'

type ProbeState =
  | { phase: 'loading' }
  | { phase: 'ok'; feeBps: number }
  | { phase: 'error'; message: string }

export function PlatformProbe() {
  const [state, setState] = useState<ProbeState>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    api.platform
      .config()
      .then((config) => {
        if (!cancelled) setState({ phase: 'ok', feeBps: config.fee_bps })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.phase === 'loading') return <p className="text-sm opacity-70">Probing API…</p>
  if (state.phase === 'error') return <p className="text-sm text-feedback-danger-text">API unreachable: {state.message}</p>
  return <p className="text-sm text-feedback-success-text">Live API OK — platform fee {state.feeBps} bps</p>
}
