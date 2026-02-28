import 'react-native-get-random-values'
import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { Stack } from 'expo-router'
import { SystemBars } from 'react-native-edge-to-edge'
import { useUnistyles } from 'react-native-unistyles'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk'
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '@/stores/auth.store'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import { ToastProvider } from '@/components/ui/Toast'
import '@/theme';

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { theme } = useUnistyles();
  const [sessionLoaded, setSessionLoaded] = useState(false)

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  })

  useEffect(() => {
    // Bootstrap: load session, exchange rate, and persisted settings in parallel.
    // Replay any pending-sync items saved from a previous session after session loads.
    Promise.all([
      useAuthStore.getState().loadSession(),
      useExchangeRateStore.getState().fetchRate(),
      useSettingsStore.getState().loadSettings(),
    ]).then(() => {
      usePendingSyncStore.getState().replayAll()
    }).finally(() => setSessionLoaded(true))
  }, [])

  // Replay pending-sync items whenever the app returns to the foreground.
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

  const isReady = (fontsLoaded || fontError) && sessionLoaded

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync()
    }
  }, [isReady])

  if (!isReady) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="error" />
          <Stack.Screen name="gig/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ToastProvider>
      <SystemBars style="auto" />
    </GestureHandlerRootView>
  )
}
