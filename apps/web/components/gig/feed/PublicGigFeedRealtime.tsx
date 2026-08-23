'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeConnection } from '@/hooks/connectivity/useRealtimeConnection'
import { useAuthStore } from '@/stores/auth.store'
import { subscribeGigFeedChannel, useRealtimeStore } from '@/stores/realtime.store'

const ANONYMOUS_REFRESH_MS = 15_000

/**
 * Invalidates the server-rendered feed when its global channel changes.
 * It deliberately receives no gig rows: passing them into a client component
 * would serialize base-unit amounts into otherwise presentation-only HTML.
 */
export function PublicGigFeedRealtime() {
  const router = useRouter()
  const loadSession = useAuthStore((state) => state.loadSession)
  const isLoading = useAuthStore((state) => state.isLoading)
  const connected = useRealtimeStore((state) => state.connected)
  const refreshQueued = useRef(false)
  const wasConnected = useRef(connected)

  useRealtimeConnection()

  useEffect(() => {
    if (isLoading) void loadSession()
  }, [isLoading, loadSession])

  const refresh = useCallback(() => {
    if (refreshQueued.current) return
    refreshQueued.current = true
    router.refresh()
    window.setTimeout(() => {
      refreshQueued.current = false
    }, 250)
  }, [router])

  useEffect(() => subscribeGigFeedChannel(refresh), [refresh])

  useEffect(() => {
    if (connected) {
      if (!wasConnected.current) refresh()
      wasConnected.current = true
      return
    }
    wasConnected.current = false
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, ANONYMOUS_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [connected, refresh])

  return null
}
