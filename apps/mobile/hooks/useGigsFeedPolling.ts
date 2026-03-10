import { useCallback, useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useGigsStore } from '@/stores/gigs.store'

const POLL_ACTIVE_MS   = 30_000  // 30s while new gigs are appearing
const POLL_IDLE_MS     = 90_000  // 90s after 3 consecutive empty polls
const EMPTY_POLL_LIMIT = 3

/**
 * Intelligent polling for the gigs feed.
 *
 * - Fetches immediately on tab focus (replaces the raw useFocusEffect call)
 * - Polls every 30s while new gigs are arriving; backs off to 90s after
 *   3 consecutive polls with no change
 * - Pauses automatically when the app goes to background; resets and
 *   resumes on foreground
 * - Stops when the tab loses focus; restarts fresh when it regains it
 */
export function useGigsFeedPolling() {
  const { fetchGigs } = useGigsStore()

  const pollTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emptyPollCount = useRef(0)
  const isFetching     = useRef(false)
  const isFocused      = useRef(false)

  const clearTimer = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const scheduleNextPoll = useCallback(() => {
    clearTimer()
    if (!isFocused.current) return
    const delay = emptyPollCount.current >= EMPTY_POLL_LIMIT ? POLL_IDLE_MS : POLL_ACTIVE_MS

    pollTimer.current = setTimeout(async () => {
      if (isFetching.current || !isFocused.current) {
        scheduleNextPoll()
        return
      }
      isFetching.current = true
      try {
        const countBefore = useGigsStore.getState().gigs.length
        await fetchGigs()
        const countAfter = useGigsStore.getState().gigs.length
        emptyPollCount.current = countAfter === countBefore
          ? emptyPollCount.current + 1
          : 0
      } finally {
        isFetching.current = false
        scheduleNextPoll()
      }
    }, delay)
  }, [clearTimer, fetchGigs])

  // Pause polling when the app goes to background; reset + resume on foreground
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        emptyPollCount.current = 0
        scheduleNextPoll()
      } else {
        clearTimer()
      }
    }
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [clearTimer, scheduleNextPoll])

  // Start on focus (immediate fetch), stop on blur
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true
      emptyPollCount.current = 0

      if (!isFetching.current) {
        isFetching.current = true
        fetchGigs()
          .then(() => { isFetching.current = false; scheduleNextPoll() })
          .catch(() => { isFetching.current = false; scheduleNextPoll() })
      } else {
        scheduleNextPoll()
      }

      return () => {
        isFocused.current = false
        clearTimer()
      }
    }, [clearTimer, fetchGigs, scheduleNextPoll]),
  )
}
