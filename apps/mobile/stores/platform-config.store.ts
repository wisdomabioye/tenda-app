import { useEffect } from 'react'
import { create } from 'zustand'
import { api } from '@/api/client'
import type { PlatformConfig } from '@tenda/shared'

interface PlatformConfigState {
  config: PlatformConfig | null
  loading: boolean
  error: string | null
  /** Fetch config; resolves immediately with cached value if already loaded. */
  fetch: () => Promise<PlatformConfig | null>
}

let inflight: Promise<PlatformConfig | null> | null = null

export const usePlatformConfigStore = create<PlatformConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  fetch: async () => {
    const cached = get().config
    if (cached) return cached
    if (inflight) return inflight

    set({ loading: true, error: null })
    inflight = api.platform.config()
      .then((cfg) => {
        set({ config: cfg, loading: false })
        return cfg
      })
      .catch((e) => {
        set({ error: e instanceof Error ? e.message : String(e), loading: false })
        return null
      })
      .finally(() => { inflight = null })

    return inflight
  },
}))

/**
 * Read the platform's poster review window (`grace_period_seconds`) and
 * lazy-fetch the config on first read. Returns `null` until the config loads;
 * consumers should hide deadline chips that depend on it until non-null.
 */
export function useGracePeriodSeconds(): number | null {
  const grace = usePlatformConfigStore((s) => s.config?.grace_period_seconds ?? null)
  const fetchConfig = usePlatformConfigStore((s) => s.fetch)
  useEffect(() => {
    if (grace == null) fetchConfig()
  }, [grace, fetchConfig])
  return grace
}
