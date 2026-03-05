import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'

async function getExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
      })
    }

    let { status } = await Notifications.getPermissionsAsync()

    if (status === 'undetermined') {
      const result = await Notifications.requestPermissionsAsync()
      status = result.status
    }

    if (status !== 'granted') return null

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
    if (!projectId) {
      console.warn('[push] Missing EAS projectId — cannot get push token')
      return null
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
    return tokenData.data
  } catch (e) {
    console.warn('[push] Failed to get push token:', e)
    return null
  }
}

export function usePushToken() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      // Remove token on logout
      if (tokenRef.current) {
        api.notifications.removeToken({ token: tokenRef.current }).catch((e) =>
          console.warn('[push] Failed to remove push token:', e),
        )
        tokenRef.current = null
      }
      return
    }

    // Register token on login / session restore
    getExpoPushToken().then((token) => {
      if (!token) return
      tokenRef.current = token
      api.notifications.registerToken({ token, platform: 'expo' }).catch((e) =>
        console.warn('[push] Failed to register push token:', e),
      )
    })
  }, [isAuthenticated])
}
