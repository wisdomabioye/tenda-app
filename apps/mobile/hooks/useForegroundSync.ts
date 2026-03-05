import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { usePendingSyncStore } from '@/stores/pending-sync.store'

/**
 * Replays pending-sync items whenever the app returns to the foreground.
 */
export function useForegroundSync() {
  const appState = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current !== 'active' && next === 'active') {
        usePendingSyncStore.getState().replayAll()
      }
      appState.current = next
    })
    return () => sub.remove()
  }, [])
}
