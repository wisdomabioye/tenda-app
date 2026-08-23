'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  classifyGigFeedQuery,
  compareGigFeedRevisions,
  compareGigSummariesByRecency,
  matchesGigFeedQuery,
  type GigFeedServerFrame,
  type GigListQuery,
} from '@tenda/shared'
import { toGigCardModel, type GigCardModel } from '@/components/gig/feed/gig-card-model'
import { useRealtimeConnection } from '@/hooks/connectivity/useRealtimeConnection'
import { useAuthStore } from '@/stores/auth.store'
import { subscribeGigFeedChannel, useRealtimeStore } from '@/stores/realtime.store'

const ANONYMOUS_REFRESH_MS = 15_000
const RECONCILE_DELAY_MS = 400

function revisionsFrom(items: readonly GigCardModel[]): Readonly<Record<string, string>> {
  return Object.fromEntries(items.map((gig) => [gig.escrow_id, gig.public_feed_revision]))
}

function isLaterPage(query: GigListQuery): boolean {
  return query.cursor !== undefined || (query.offset ?? 0) > 0
}

export function usePublicGigFeedRealtime(args: {
  items: readonly GigCardModel[]
  query: GigListQuery
  applyItems: (items: GigCardModel[], membershipDelta: number) => void
}): void {
  const router = useRouter()
  const isLoading = useAuthStore((state) => state.isLoading)
  const loadSession = useAuthStore((state) => state.loadSession)
  const connected = useRealtimeStore((state) => state.connected)
  const itemsRef = useRef<readonly GigCardModel[]>(args.items)
  const revisionsRef = useRef<Readonly<Record<string, string>>>(revisionsFrom(args.items))
  const argsRef = useRef(args)
  const refreshTimer = useRef<number | null>(null)
  const wasConnected = useRef(connected)

  useRealtimeConnection()
  useEffect(() => { if (isLoading) void loadSession() }, [isLoading, loadSession])
  useEffect(() => {
    argsRef.current = args
    itemsRef.current = args.items
    revisionsRef.current = { ...revisionsRef.current, ...revisionsFrom(args.items) }
  }, [args])

  const reconcile = useCallback((immediate = false) => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      router.refresh()
    }, immediate ? 0 : RECONCILE_DELAY_MS)
  }, [router])

  useEffect(() => {
    const unsubscribe = subscribeGigFeedChannel((event: GigFeedServerFrame) => {
      const current = argsRef.current
      const id = event.type === 'gig_available' ? event.gig.escrow_id : event.escrow_id
      const knownRevision = revisionsRef.current[id]
      if (knownRevision !== undefined && compareGigFeedRevisions(event.gig_revision, knownRevision) <= 0) return
      revisionsRef.current = { ...revisionsRef.current, [id]: event.gig_revision }

      const classification = classifyGigFeedQuery(current.query)
      if (event.type === 'gig_available' && (
        classification !== 'client_matchable' || isLaterPage(current.query)
      )) {
        reconcile()
        return
      }
      const wasVisible = itemsRef.current.some((gig) => gig.escrow_id === id)
      const withoutEventGig = itemsRef.current.filter((gig) => gig.escrow_id !== id)
      const isVisible = event.type === 'gig_available' && matchesGigFeedQuery(event.gig, current.query)
      const next = isVisible
        ? [...withoutEventGig, toGigCardModel(event.gig)].sort(compareGigSummariesByRecency)
        : withoutEventGig
      const limit = current.query.limit ?? next.length
      itemsRef.current = next.slice(0, limit)
      current.applyItems([...itemsRef.current], Number(isVisible) - Number(wasVisible))
      reconcile()
    })
    return () => {
      unsubscribe()
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    }
  }, [reconcile])

  useEffect(() => {
    if (connected) {
      if (!wasConnected.current) reconcile(true)
      wasConnected.current = true
      return
    }
    wasConnected.current = false
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reconcile(true)
    }, ANONYMOUS_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [connected, reconcile])
}
