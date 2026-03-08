import 'react-native-get-random-values'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { useUnistyles } from 'react-native-unistyles'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ToastProvider } from '@/components/ui/Toast'
import { DevnetBanner, IS_DEVNET } from '@/components/feedback/DevnetBanner'
import { configureNotifications } from '@/lib/notifications'
import { initReporter, wrapApp } from '@/lib/reporter'
import { useAppReady } from '@/hooks/useAppReady'
import { useNotificationDeepLink } from '@/hooks/useNotificationDeepLink'
import { useForegroundSync } from '@/hooks/useForegroundSync'
import { usePushToken } from '@/hooks/usePushToken'
import '@/theme'

initReporter()
configureNotifications()
SplashScreen.preventAutoHideAsync()

export default wrapApp(function RootLayout() {
  const { theme } = useUnistyles()
  const isReady = useAppReady()
  const insets = useSafeAreaInsets()
  useNotificationDeepLink()
  useForegroundSync()
  usePushToken()

  if (!isReady) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <DevnetBanner />
      {/* When the banner is visible it consumes insets.top, so we zero it out
          for everything below to prevent the header double-counting it. */}
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: IS_DEVNET ? 0 : insets.top }}>
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
      </SafeAreaInsetsContext.Provider>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  )
})
