import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'

/**
 * Replays pending-sync items and refreshes exchange rates whenever the app
 * returns to the foreground. fetchRates' internal TTL check prevents
 * unnecessary network calls.
 */
export function useForegroundSync() {
  const appState = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current !== 'active' && next === 'active') {
        usePendingSyncStore.getState().replayAll()
        useExchangeRateStore.getState().fetchRates()
      }
      appState.current = next
    })
    return () => sub.remove()
  }, [])
}
