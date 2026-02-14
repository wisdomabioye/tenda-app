import { useEffect, useState } from 'react'
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
    useAuthStore.getState().loadSession().finally(() => setSessionLoaded(true))
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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="error" />
        <Stack.Screen name="gig/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <SystemBars style="auto" />
    </GestureHandlerRootView>
  )
}
