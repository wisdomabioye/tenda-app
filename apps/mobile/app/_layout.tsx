import 'react-native-get-random-values'
import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { SystemBars } from 'react-native-edge-to-edge'
import { useUnistyles } from 'react-native-unistyles'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
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
import { useOnboardingStore } from '@/stores/onboarding.store'
import { ToastProvider } from '@/components/ui/Toast'
import { configureNotifications } from '@/lib/notifications'
import { usePushToken } from '@/hooks/usePushToken'
import { initReporter, wrapApp } from '@/lib/reporter'
import '@/theme';

initReporter()
configureNotifications()

SplashScreen.preventAutoHideAsync()

export default wrapApp(function RootLayout() {
  const { theme } = useUnistyles();
  const router = useRouter()
  usePushToken()
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
      useOnboardingStore.getState().load(),
    ]).then(() => {
      usePendingSyncStore.getState().replayAll()
    }).finally(() => setSessionLoaded(true))
  }, [])

  // Handle notification taps — deep-link to the right screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined
      if (!data) return
      if (data.screen === 'gig' && data.gigId) {
        router.push(`/gig/${data.gigId}` as Parameters<typeof router.push>[0])
      } else if (data.screen === 'chat' && data.userId) {
        router.push(`/chat/${data.userId}` as Parameters<typeof router.push>[0])
      }
    })
    return () => sub.remove()
  }, [router])

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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(support)" />
          <Stack.Screen name="error" />
          <Stack.Screen name="gig/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="chat/[userId]" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ToastProvider>
      <SystemBars style="auto" />
    </GestureHandlerRootView>
  )
});
