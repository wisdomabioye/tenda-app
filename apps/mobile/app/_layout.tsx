import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { SystemBars } from 'react-native-edge-to-edge'
import { View } from 'react-native'
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
import { Spinner } from '@/components/feedback'
import '@/theme';

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { theme } = useUnistyles();
  const [appIsReady, setAppIsReady] = useState(false)

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
    async function prepare() {
      try {
        await useAuthStore.getState().loadSession()
      } catch (e) {
        console.warn('Error initializing session:', e)
      } finally {
        setAppIsReady(true)
      }
    }

    prepare()
  }, [])

  useEffect(() => {
    // Hide native splash once fonts are loaded
    async function hideSplash() {
      if (fontsLoaded || fontError) {
        await SplashScreen.hideAsync();
      }
    }

    hideSplash();
    
  }, [fontsLoaded, fontError])

  // Native splash still visible while fonts load
  if (!fontsLoaded && !fontError) {
    return null
  }

  // Show loading screen while session initializes
  if (!appIsReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={52} />
        </View>
        <SystemBars style="auto" />
      </GestureHandlerRootView>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack screenOptions={{ headerShown: false }}>
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
